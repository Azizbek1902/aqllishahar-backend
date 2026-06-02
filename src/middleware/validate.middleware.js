import { ApiError } from './error.middleware.js';

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
    if (error) {
      const messages = error.details.map((d) => d.message).join(', ');
      return next(new ApiError(422, 'error.validation', messages));
    }
    req[source] = value;
    next();
  };
}
