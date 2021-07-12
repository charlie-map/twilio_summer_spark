require('dotenv').config({
	path: __dirname + "/.env"
});
// Download the helper library from https://www.twilio.com/docs/node/install
// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

const fs = require('fs');

const readline = require('readline');
const quest = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	terminal: false
});

const parsePhoneNumber = require('libphonenumber-js');

/*
	PROCESS ARGV
	
	There are three arguments require for this to run:

	0: an csv containing necessary columns
		( MUST contain a phone number named: "number" )

	1: a flagging system for which to decide whether it's a phone call or a sms
		( MUST contain either "sms" OR "call" -- named: "flag" )

	2: a template that will be the message ( for sms or call )
		( values that should be entered into the template should be display as follows: 
			ex. "Hi there! We hope you, {{NAME}}, are doing well!"
			ensure these columns match the csv -- named: "template" )

	3: a force flag for allowing a cron to hard send without checking
*/

function send_call(all_callers) {
	return new Promise(async (full_resolve) => {
		let send_calls = all_callers.map(call => {
			return new Promise((resolve, reject) => {
				client.calls
					.create({
						machineDetection: "DetectMessageEnd",
						twiml: '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Matthew-Neural">' + call[1] + '</Say></Response>',
						to: call[0],
						from: process.env.TWILIO_PHONE_NUMBER
					})
					.then(cb_message => {
						resolve("Accepted: " + call[0] + " " + cb_message.sid);
					})
					.catch(err => {
						reject("Number " + call[0] + " rejected: " + err.message);
					});
			});
		});

		send_calls = await Promise.allSettled(send_calls);
		console.log(send_calls);
		full_resolve();
	});
}

function send_sms(all_messages) {
	return new Promise(async (full_resolve) => {
		let send_messages = all_messages.map(message => {
			return new Promise((resolve, reject) => {
				client.messages
					.create({
						body: message[1],
						to: message[0],
						from: process.env.TWILIO_PHONE_NUMBER
					})
					.then(cb_message => {
						resolve("Accepted: " + message[0] + " " + cb_message.sid);
					})
					.catch(err => {
						reject("Number " + message[0] + " rejected: " + err.message);
					});
			});
		});

		send_messages = await Promise.allSettled(send_messages);
		console.log(send_messages);
		full_resolve();
	});
}

function retrieve_data(question) {

	return new Promise((resolve) => {
		quest.question(question, resolve);
	});
}

async function run_process(number, flag, template, force) {

	if (!number) {
		console.log("\nYou're missing the csv file argument");
		number = await retrieve_data("Please add a file path to a csv: ");
	}

	if (!flag) {
		console.log("\nYou're missing the flag argument");
		flag = await retrieve_data("Please add a flag (either 'sms' or 'call'): ");
	}
	if (!template) {
		console.log("\nYou're missing the template argument");
		template = await retrieve_data("Please add a template argument: ");
	}

	// convert csv to a json object
	let data;

	data = await new Promise((resolve, reject) => {
		fs.readFile(process.argv[2], (err, file_buffer) => {
			if (err) reject(err);

			resolve(csvJSON(file_buffer.toString()));
		});
	});

	// use data (json) object to replace variables within template
	let error = 0;
	let needed_variables = template.split("{{")[0].indexOf("}}") == -1 ? template.split("{{").slice(1).map(item => item.split("}}")[0]) : template.split("{{").map(item => item.split("}}")[0]);
	let building_templates = [];

	console.log("\n");
	data.forEach((item, index) => {
		let message_data = [item.number, template];

		// run through each word and examine
		needed_variables.forEach(check_var => {
			let low_check_var = check_var.toLowerCase();
			error = error != -1 ? item[low_check_var] ? (item[low_check_var] == "NULL" || item[low_check_var] == "null") ? -1 : 1 : -1 : error;

			if (error == -1) throw "Unused variable in template on value: " + item + " {{" + check_var + "}} " + item[low_check_var];
			message_data[1] = message_data[1].replace(new RegExp("{{" + check_var + "}}", 'g'), item[low_check_var]);
		});


		// phone number checking
		if (!item.number || item.number.toLowerCase() == "null") {
			if (!item.number) console.log("\nPlease ensure the phone number field is labeled 'number' for users", item);
			else console.log("\nAn error occured for the cell phone on user", item);
			return;
		}

		let phoneNumber = parsePhoneNumber(item.number, "US");

		if (!phoneNumber.isValid()) {
			console.log("\nThere was an error with the cell phone number for user", item);
			return;
		}

		message_data[0] = phoneNumber.format("E.164");
		building_templates.push(message_data);
	});

	console.log("\n\n");
	building_templates.forEach((template_display) => {
		console.log("\n", template_display[0], template_display[1]);
	});

	await new Promise(async (resolve, reject) => {
		if (!force) {
			quest.question("\n\nHi there - How does this look? y (Looks good!), n (Cancel!) ", async function(value) {
				if (value != "y")
					return reject("User denied the offered messages");

				console.log("\nSending message!");

				if (flag == "sms")
					await send_sms(building_templates);
				else if (flag == "call")
					await send_call(building_templates);

				quest.close();
				resolve();
			});
		} else {
			if (flag == "sms")
				await send_sms(building_templates);
			else if (flag == "call")
				await send_call(building_templates);
			resolve();
		}
	});
	return;
}

run_process(process.argv[2], process.argv[3], process.argv[4], process.argv[5]).then(() => {
	console.log("\ndone");
	process.exit();
}).catch((error) => {
	console.log("\nSomething went wrong...", error);
	quest.close();
	process.exit();
});

//var csv is the CSV file with headers
function csvJSON(csv) {

	var lines = csv.split("\n");

	var result = [];

	// NOTE: If your columns contain commas in their values, you'll need
	// to deal with those before doing the next step 
	// (you might convert them to &&& or something, then covert them back later)
	// jsfiddle showing the issue https://jsfiddle.net/
	var headers = lines[0].split(",");

	headers = headers.map(item => item.trim());

	for (var i = 1; i < lines.length; i++) {

		var obj = {};
		var currentline = lines[i].split(",");

		for (var j = 0; j < headers.length; j++) {
			obj[headers[j]] = currentline[j].trim();
		}

		result.push(obj);

	}

	//return result; //JavaScript object
	return result; //JSON
}