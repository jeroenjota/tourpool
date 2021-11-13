const Joi = require('joi');

module.exports.userSchema = Joi.object({
  user: Joi.object({
    username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required(),
    email: Joi.string()
    .email()
    .required(),
    vNaam: Joi.string(),
    tNaam: Joi.string(),
    aNaam: Joi.string()
  })
});