# Twilio Summer Spark
A dynamic script that sends SMS/calls to any numbers provided in the csv file provided

# Running The System
- You will have to create an account on Twilio and purchase a phone number.
- Run `npm install`
- Run `node twilio_summerspark.js` followed by three arguments respectively: a csv file path, either `sms` (for texts) or `call` (for calls), and the a template message.

# Template Messages
- `Hello {{NAME}}! We're excited to be hosting you at {{TITLE}} this week!`
- For each of the items inside of the mustaches ( `{{}}` ), ensure they line up with the info in the csv columns. The program will log errors if there is a break between the information in the csv, and the information in the template

# Enjoy!
