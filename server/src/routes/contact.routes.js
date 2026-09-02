const { Router } = require("express");
const { body, validationResult } = require("express-validator");
const { sendContact } = require("../controllers/contact.controller");

const router = Router();

router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Name is required").isLength({ max: 80 }),
    body("email").trim().isEmail().withMessage("A valid email is required").normalizeEmail(),
    body("subject").optional({ values: "falsy" }).trim().isLength({ max: 120 }),
    body("message")
      .trim()
      .notEmpty()
      .withMessage("Message is required")
      .isLength({ min: 10, max: 2000 })
      .withMessage("Message must be between 10 and 2000 characters"),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }
    next();
  },
  sendContact
);

module.exports = router;
