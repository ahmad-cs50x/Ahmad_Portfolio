const mailer = require("../utils/mailer");

exports.sendContact = async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;

    await mailer.sendMessage({
      name,
      email,
      subject: subject || "New portfolio message",
      message,
    });

    return res.status(201).json({
      success: true,
      message: "Message sent successfully! I'll get back to you within 24 hours.",
    });
  } catch (err) {
    next(err);
  }
};
