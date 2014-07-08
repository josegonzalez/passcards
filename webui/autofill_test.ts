import autofill = require('./autofill');
import itemBuilder = require('../lib/item_builder');
import onepass = require('../lib/onepass');
import testLib = require('../lib/test');
import pageAccess = require('./page_access');

class FakePageAccess {
	private pageChangeListeners: Array<(url: string) => void>;
	
	formList: pageAccess.InputField[];
	autofillEntries: pageAccess.AutoFillEntry[];

	constructor() {
		this.formList = [];
		this.autofillEntries = [];
	}

	oauthRedirectUrl() {
		return '';
	}

	addPageChangedListener(listener: (url: string) => void) : void {
		this.pageChangeListeners.push(listener);
	}

	findForms(callback: (formList: pageAccess.InputField[]) => void) : void {
		setTimeout(() => {
			callback(this.formList);
		}, 0);
	}

	autofill(fields: pageAccess.AutoFillEntry[]) {
		this.autofillEntries = fields;
	}
}

function itemWithUsernameAndPassword(user: string, password: string) : onepass.Item {
	return new itemBuilder.Builder(onepass.ItemTypes.LOGIN)
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
		id: 'username',
		name: 'username',
		type: pageAccess.FieldType.Text
	});

	fakePage.formList.push({
		id: '',
		name: 'password',
		type: pageAccess.FieldType.Password
	});

	var autofiller = new autofill.AutoFiller(fakePage);
	autofiller.autofill(item).then(() => {

		fakePage.autofillEntries.sort((a,b) => {
			return a.fieldName.localeCompare(b.fieldName);
		});

		assert.deepEqual(fakePage.autofillEntries, [
			{ fieldId: '', fieldName: 'password', value: 'testpass' },
			{ fieldId: 'username', fieldName: 'username', value: 'testuser@gmail.com' }
		]);

		testLib.continueTests();
	}).done();
});

testLib.start();
