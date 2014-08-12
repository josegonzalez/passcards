/// <reference path="../typings/firefox-addon-sdk.d.ts" />

import buttons = require('sdk/ui/button/toggle');
import hotkeys = require('sdk/hotkeys');
import panel = require('sdk/panel');
import preferences_service = require('sdk/preferences/service');
import self_ = require('sdk/self');
import tabs = require('sdk/tabs');
import xhr = require('sdk/net/xhr');

import rpc = require('./rpc');

interface PageWorker extends ContentWorker {
	rpc?: rpc.RpcHandler;
}

var mainPanel: panel.Panel;
var toolbarButton: buttons.ToggleButton;
var tabWorkers: {[index: string]: PageWorker} = {};
var panelRpc: rpc.RpcHandler;

function getTabWorker(tab: Tab) {
	if (!tabWorkers[tab.id]) {
		var worker : PageWorker = tab.attach({
			contentScriptFile: self_.data.url('scripts/page.js')
		});
		worker.rpc = new rpc.RpcHandler(worker.port);
		worker.on('detach', () => {
			delete tabWorkers[tab.id];
		});
		tabWorkers[tab.id] = worker;
	}
	return tabWorkers[tab.id];
}

function notifyPageChanged(tab: Tab) {
	if (panelRpc) {
		panelRpc.call('pagechanged', [tabs.activeTab.url]);
	}
}

function onPanelHidden() {
	toolbarButton.state('window', { checked: false });
};

function main() {
	// disable strict mode in development to suppress a large
	// number of console warnings from normal web pages
	preferences_service.set('javascript.options.strict', false);

	// read internal settings
	var PREF_ROOT = 'extensions.' + self_.id + '.';
	var syncService = preferences_service.get(PREF_ROOT + '.syncService', 'dropbox');

	tabs.on('ready', (tab) => {
		if (tab === tabs.activeTab) {
			notifyPageChanged(tab);
		}
	});

	tabs.on('activate', (tab) => {
		notifyPageChanged(tab);
	});

	var showPanel = (state: ButtonState) => {
		if (!mainPanel) {
			mainPanel = new panel.Panel({
				width: 400,
				height: 400,
				contentURL : self_.data.url('index.html'),
				contentScriptFile: self_.data.url('scripts/panel_content.js'),
				contentScriptWhen: 'start',
				contentScriptOptions: {
					syncService: syncService
				},
				onHide: onPanelHidden
			});
			
			panelRpc = new rpc.RpcHandler(mainPanel.port);

			mainPanel.port.on('oauth-credentials-received', (hash: string) => {
				mainPanel.contentURL = self_.data.url('index.html') + hash;
			});

			panelRpc.onAsync('find-fields', (done) => {
				getTabWorker(tabs.activeTab).rpc.call('find-fields', [], (err, fields) => {
					done(err, fields);
				});
			});

			panelRpc.onAsync('autofill', (done: (err: any, result: number) => void, entries: any[]) => {
				getTabWorker(tabs.activeTab).rpc.call('autofill', [entries], (err: any, count: number) => {
					done(err, count);
				});
			});

			panelRpc.on<void>('ready', () => {
				notifyPageChanged(tabs.activeTab);
				panelRpc.call('show', []);
			});
			
			panelRpc.onAsync('fetch-url', (done: (err: any, result: any) => void, url: string) => {
				// copied from collectionutil.ts
				function stringFromBuffer(buf: any) : string {
					var str = '';
					for (var i=0; i < buf.length; i++) {
						str += String.fromCharCode(buf[i]);
					}
					return str;
				}

				try {
					var request = new xhr.XMLHttpRequest();
					request.open('GET', url, true /* async */);
					request.responseType = 'arraybuffer';
					request.onloadend = (e) => {
						var result = {
							status: request.status,
							body: stringFromBuffer(new Uint8Array(request.response))
						};
						done(null, result);
					};
					request.send();
				} catch (err) {
					console.log('sending XHR failed', err.toString());
					done(err, null);
				}
			});
		}

		if (state.checked) {
			mainPanel.show({
				position: toolbarButton
			});
			panelRpc.call('show', []);
		}
	};

	toolbarButton = new buttons.ToggleButton({
		id: 'passcards-icon',
		label: 'passcards Password Manager',
		icon: {
			'32' : './icon-32.png',
			'64' : './icon-64.png'
		},
		onChange: showPanel
	});

	var hotkey = new hotkeys.Hotkey({
		combo: 'alt-shift-p',
		onPress: () => {
			toolbarButton.click();
		}
	});
}

main();
