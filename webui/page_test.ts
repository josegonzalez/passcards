import Q = require('q');

import forms = require('../webui/forms');
import rpc = require('../lib/net/rpc');
import page = require('../webui/page');
import testLib = require('../lib/test');

global.HTMLFormElement = global.window.HTMLFormElement;
global.Event = global.window.Event;

const SAMPLE_INPUT_FORM = `
	<form>
		<input name="username" placeholder="Email" id="user_field">
		<input type="password" placeholder="Password" id="pass_field">
		<input type="submit" placeholder="Sign in">
	</form>
`;

// A simple MessagePort implementation for use with rpc.RpcHandler.
class RpcPort implements rpc.MessagePort<rpc.CallMessage, rpc.ReplyMessage> {
	private handlers: {
		method: string;
		callback: (data: any) => any;
	}[];

	constructor(public receiver?: RpcPort) {
		this.handlers = [];
		if (receiver) {
			this.receiver.receiver = this;
		}
	}

	// registers a handler for a method. When emit() is called
	// on the paired port, the corresponding on() callback will
	// be called
	on(method: string, handler: (data: any) => any): void {
		this.handlers.push({
			method: method,
			callback: handler
		});
	}

	emit(method: string, data: Object): void {
		setTimeout(() => {
			this.receiver.handlers.forEach(handler => {
				if (handler.method == method) {
					handler.callback(data);
				}
			})
		}, 0);
	}
};

// creates a pair of ports that can be used with rpc.RpcHandler
function createClientServerPortPair(): [RpcPort, RpcPort] {
	let clientPort = new RpcPort();
	let serverPort = new RpcPort(clientPort);
	return [clientPort, serverPort];
}

function setupTestPage() {
	global.document.getElementById('app').innerHTML = SAMPLE_INPUT_FORM;
}

testLib.addAsyncTest('should find inputs in document', assert => {
	setupTestPage();

	let[clientPort, serverPort] = createClientServerPortPair();

	let pageScriptRpc = new rpc.RpcHandler(serverPort);
	let extensionRpc = new rpc.RpcHandler(clientPort);
	let done = Q.defer<void>();

	page.init(pageScriptRpc);
	extensionRpc.call<forms.FieldGroup[]>('find-fields', [], (err: Error, fields: forms.FieldGroup[]) => {
		assert.equal(err, undefined);
		assert.equal(fields.length, 1);
		const EXPECTED_FIELDS: forms.InputField[] = [
			{
				key: 0,
				id: 'user_field',
				name: 'username',
				type: forms.FieldType.Text,
				visible: false,
				placeholder: undefined
			},
			{
				key: 1,
				id: 'pass_field',
				name: '',
				type: forms.FieldType.Password,
				visible: false,
				placeholder: undefined
			},
			{
				key: 2,
				id: '',
				name: '',
				type: forms.FieldType.Button,
				visible: false,
				placeholder: undefined
			}
		];
		assert.deepEqual(fields[0].fields, EXPECTED_FIELDS);
		done.resolve(null);
	});
	return done.promise;
});

testLib.addAsyncTest('should autofill inputs in document', assert => {
	setupTestPage();

	let[clientPort, serverPort] = createClientServerPortPair();
	let pageScriptRpc = new rpc.RpcHandler(serverPort);
	let extensionRpc = new rpc.RpcHandler(clientPort);
	page.init(pageScriptRpc);

	let usernameField = <HTMLInputElement>document.querySelector('#user_field');
	let passwordField = <HTMLInputElement>document.querySelector('#pass_field');

	let usernameChangeCount = 0;
	let passwordChangeCount = 0;

	usernameField.addEventListener('input',() => ++usernameChangeCount);
	passwordField.addEventListener('input',() => ++passwordChangeCount);

	const AUTOFILL_VALUES = [{
		key: 0,
		value: 'jsmith@gmail.com'
	}, {
			key: 1,
			value: 'secret'
		}];

	let foundFields = Q.defer<forms.FieldGroup[]>();
	extensionRpc.call('find-fields', [], foundFields.makeNodeResolver());

	return foundFields.promise.then(fieldGroups => {
		assert.equal(fieldGroups.length, 1);
		assert.equal(fieldGroups[0].fields.length, 3);

		let filled = Q.defer<number>();
		extensionRpc.call('autofill', [AUTOFILL_VALUES], filled.makeNodeResolver());
		return filled.promise;
	}).then(count => {
		assert.equal(count, 2);
		assert.equal(usernameField.value, 'jsmith@gmail.com');
		assert.equal(passwordField.value, 'secret');
		assert.equal(usernameChangeCount, 1);
		assert.equal(passwordChangeCount, 1);
	});
});
