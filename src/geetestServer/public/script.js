// Extract user's discord id from URL
const userId = window.location.href.split("/").pop();

document.addEventListener("DOMContentLoaded", async () => {
	// Get the mmt from api
	const mmtResponse = await fetch(`/geetest/mmt/${userId}`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json"
		}
	});
	const mmt = await mmtResponse.json();

	// Initialize geetest when mmt is created successfully
	if (mmtResponse.status === 200) {
		initGeetest(
			{
				gt: mmt.gt,
				challenge: mmt.challenge,
				offline: false,
				new_captcha: true,
				lang: mmt.lang
			},
			handleGeetest
		);
	} else {
		// Display error message when failed to create mmt
		displayResult(mmt.message);
	}
});

async function handleGeetest(captcha) {
	// Add captcha to html
	captcha.appendTo("#geetest");
	captcha
		.onReady(() => {})
		.onSuccess(async () => {
			// Verify captcha output after user solved it
			await verifyGeetest(captcha);
		})
		.onError(error => {
			// Display error message when User failed to solve the captcha
			displayResult(
				`Error! Please retry. <br />Error msg: ${JSON.stringify(error)}`
			);
		});
}

// Verify user geetest output
async function verifyGeetest(captcha) {
	// Get the captcha output completed by user
	var captchaOutput = captcha.getValidate();

	console.log(JSON.stringify(captchaOutput));

	// Verify the result
	const verifyResult = await fetch(`/geetest/${userId}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify(captchaOutput)
	});
	const result = await verifyResult.json();

	// Display result
	if (verifyResult.status === 200) {
		displayResult(
			"Complete Geestest Validation! You may now close this window"
		);
	} else {
		displayResult(
			`Error! Please click F5 to retry. Error msg: ${result.message}`
		);
	}
}

// Show geetest result or error message
function displayResult(message) {
	var messageElement = document.createElement("div");
	messageElement.className = "message";
	messageElement.innerHTML = message;
	document.querySelector(".content").appendChild(messageElement);
}
