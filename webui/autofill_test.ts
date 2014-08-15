import autofill = require('./autofill');
import event_stream = require('../lib/base/event_stream');
import forms = require('./forms');
import item_builder = require('../lib/item_builder');
import onepass = require('../lib/onepass');
import page_access = require('./page_access');
import site_info = require('../lib/siteinfo/site_info');
import testLib = require('../lib/test');

class FakePageAccess implements page_access.PageAccess {
	formList: forms.InputField[];
	autofillEntries: forms.AutoFillEntry[];

	showEvents: event_stream.EventStream<void>;
	pageChanged: event_stream.EventStream<string>;
	currentUrl: string;

	constructor() {
		this.formList = [];
		this.autofillEntries = [];
		this.showEvents = new event_stream.EventStream<void>();
		this.pageChanged = new event_stream.EventStream<string>();
		this.currentUrl = '';
	}

	oauthRedirectUrl() {
		return '';
	}

	findForms(callback: (formList: forms.InputField[]) => void) : void {
		setTimeout(() => {
			callback(this.formList);
		}, 0);
	}

	autofill(fields: forms.AutoFillEntry[]) {
		this.autofillEntries = fields;
	}

	siteInfoProvider() : site_info.SiteInfoProvider {
		return null;
	}
}

function itemWithUsernameAndPassword(user: string, password: string) : onepass.Item {
	return new item_builder.Builder(onepass.ItemTypes.LOGIN)
	  .setTitle('Test Item')
	  .addLogin(user)
	  .addPassword(password)
	  .addUrl('mysite.com')
	  .item();
}

testLib.addAsyncTest('simple user/password autofill', (assert) => {
	var item = itemWithUsernameAndPassword('testuser@gmail.com', 'testpass');
	var fakePage = new FakePageAccess();

	fakePage.formList.push({
		key: 'f1',
		id: 'username',
		name: 'username',
		type: forms.FieldType.Text
	});

	fakePage.formList.push({
		key: 'f2',
		id: '',
		name: 'password',
		type: forms.FieldType.Password
	});

	var autofiller = new autofill.AutoFiller(fakePage);
	autofiller.autofill(item).then(() => {

		fakePage.autofillEntries.sort((a,b) => {
			return a.key.localeCompare(b.key);
		});

		assert.deepEqual(fakePage.autofillEntries, [
			{ key: 'f1', value: 'testuser@gmail.com' },
			{ key: 'f2', value: 'testpass' }
		]);

		testLib.continueTests();
	}).done();
});

testLib.start();