import aws from "aws-sdk";
const ses = new aws.SES();

export const sendEmail = async ({ to, subject, text }) => {
  var params = {
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Body: {
        Text: { Data: text },
      },

      Subject: { Data: subject },
    },
    Source: "no-reply@redstone.finance",
  };

  try {
    await ses.sendEmail(params).promise();
  } catch (e) {
    // We handle and log this error, because most likely
    // it is a problem with SES (not with the request)
    console.error("Email sending failed", e.stack);
  }
};
