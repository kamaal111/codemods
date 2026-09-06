import Joi from 'joi';

export const userSchema = Joi.object().keys({
  name: Joi.string().min(2).max(50).required(),
  age: Joi.number().integer().min(0).max(150),
  email: Joi.string().required(),
});

export const configSchema = Joi.object().pattern(Joi.string(), Joi.number());

export enum MemberStatus {
  Active = 'active',
  Inactive = 'inactive',
  Pending = 'pending',
}

// articleSchema covers: boolean, uri, guid, isoDate, array of items,
// nullable (allow null), description, and number greater/less validations.
export const articleSchema = Joi.object().keys({
  id: Joi.string().guid().required(),
  title: Joi.string().min(1).max(200).required(),
  url: Joi.string().uri().required(),
  isPublished: Joi.boolean().required(),
  publishedAt: Joi.string().isoDate().required(),
  tags: Joi.array().items(Joi.string()).required(),
  rating: Joi.number().greater(0).less(10),
  notes: Joi.string().allow(null),
  summary: Joi.string().description('A brief summary of the article'),
});

// memberSchema covers: alternatives/try (union), valid/enum via a TypeScript enum (optional),
// and valid/enum with .required() (both spread and literal forms).
export const memberSchema = Joi.object().keys({
  id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
  name: Joi.string().min(1).required(),
  status: Joi.string()
    .valid(...Object.values(MemberStatus))
    .required(),
  role: Joi.string().valid('admin', 'editor', 'viewer').required(),
  preferredTheme: Joi.string().valid('light', 'dark'),
});

// addressSchema and orderItemSchema are sub-schemas used inside orderSchema to
// demonstrate complex nested schema composition.
const addressSchema = Joi.object().keys({
  street: Joi.string().min(5).required(),
  city: Joi.string().min(3).required(),
  postalCode: Joi.string().alphanum().required(),
});

const orderItemSchema = Joi.object().keys({
  productId: Joi.string().min(8).required(),
  quantity: Joi.number().integer().min(1).required(),
  unitPrice: Joi.number().greater(0).required(),
});

// orderSchema is a complex schema that composes addressSchema and orderItemSchema,
// demonstrates pattern-to-record, and mixes required, optional, and nullable fields.
export const orderSchema = Joi.object().keys({
  orderId: Joi.string().min(10).max(36).required(),
  customerId: Joi.string().min(2).required(),
  items: Joi.array().items(orderItemSchema).required(),
  shippingAddress: addressSchema,
  discount: Joi.number().min(0).max(100).allow(null),
  metadata: Joi.object().pattern(Joi.string(), Joi.string()),
});

// contactSchema covers the newly added transformations:
// email() → z.email(), domain() → hostname() → z.hostname(),
// hex() → z.hex(), base64() → z.base64(),
// case('lower') → toLowerCase(), and isoDuration() → z.iso.duration().
export const contactSchema = Joi.object().keys({
  email: Joi.string().email().required(),
  website: Joi.string().domain().required(),
  colorCode: Joi.string().hex().required(),
  avatar: Joi.string().base64(),
  preferredUsername: Joi.string().case('lower').required(),
  sessionDuration: Joi.string().isoDuration(),
});

// callbackSchema demonstrates the func() → z.function() transformation.
export const callbackSchema = Joi.func().required();

export const auditSchema = Joi.object().keys({
  createdAt: Joi.date().required(),
  reviewedAt: Joi.date().min('2020-01-01').required(),
});

export const inventorySchema = Joi.object().keys({
  sku: Joi.string().alphanum().required(),
  checksum: Joi.string().min(6).hex().required(),
  weight: Joi.number().precision(2).required(),
  servicePort: Joi.number().port().required(),
  warehouses: Joi.array().items(Joi.string()).unique().required(),
  serialNumber: Joi.string()
    .regex(/^[A-Z]{2}\d{6}$/, 'serial-format')
    .required(),
});

export const paymentSchema = Joi.object()
  .keys({
    cardToken: Joi.string(),
    bankAccount: Joi.string(),
  })
  .xor('cardToken', 'bankAccount');

export const shipmentSchema = Joi.object().keys({
  method: Joi.string().valid('express', 'ground').required(),
  trackingNumber: Joi.string().when('method', {
    is: 'express',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
});

export const subscriptionSchema = Joi.object().keys({
  seats: Joi.number().integer().required(),
  plan: Joi.string().valid('free', 'team').required(),
  billingEmail: Joi.string()
    .email()
    .when('seats', { is: Joi.number().min(2).required(), then: Joi.required() }),
  purchaseOrder: Joi.string().when('plan', { is: 'team', then: Joi.string().min(4).required() }),
});

export const registrationSchema = Joi.object()
  .keys({
    password: Joi.string().min(8).required(),
    confirmPassword: Joi.string().required(),
  })
  .assert('.confirmPassword', Joi.ref('password'), 'passwords must match');

export const couponSchema = Joi.object().keys({
  code: Joi.string()
    .custom(value => value.trim().toUpperCase())
    .required(),
  referral: Joi.string().custom((value, helpers) => {
    if (value.startsWith('EXPIRED')) return helpers.error('any.invalid');

    return value;
  }),
});

// attachmentSchema covers binary() → instanceof(Buffer).
export const attachmentSchema = Joi.object().keys({
  filename: Joi.string().required(),
  content: Joi.binary().required(),
});

// premiumAccountSchema covers concat() → intersection().
export const premiumAccountSchema = Joi.object()
  .keys({ id: Joi.string().required() })
  .concat(Joi.object().keys({ tier: Joi.string().valid('gold', 'platinum').required() }));

// accessRequestSchema covers the remaining object relations: or, oxor, and, nand, with, and
// without (xor is already covered by paymentSchema above).
export const accessRequestSchema = Joi.object()
  .keys({
    email: Joi.string(),
    phone: Joi.string(),
    backupCode: Joi.string(),
    recoveryQuestion: Joi.string(),
    managerApproval: Joi.string(),
    budgetCode: Joi.string(),
    ticketId: Joi.string(),
    approvalNote: Joi.string(),
    isUrgent: Joi.boolean(),
    escalationContact: Joi.string(),
  })
  .or('email', 'phone')
  .oxor('backupCode', 'recoveryQuestion')
  .and('managerApproval', 'budgetCode')
  .nand('ticketId', 'approvalNote')
  .with('isUrgent', 'escalationContact')
  .without('ticketId', 'escalationContact');
