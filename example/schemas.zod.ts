// GENERATED FILE — DO NOT EDIT BY HAND.
// Produced by running the joi-to-zod codemod against example/schemas.ts.
// Regenerate with `yarn generate:example-snapshot`; keeping this file in sync is enforced
// by `yarn check:example-snapshot` (part of `yarn quality`).

import { z } from 'zod';

export const userSchema = z
  .object({
    name: z.string().min(2).max(50),
    age: z.number().int().min(0).max(150).optional(),
    email: z.string(),
  })
  .strict();

export const configSchema = z.record(z.string(), z.number()).optional();

export enum MemberStatus {
  Active = 'active',
  Inactive = 'inactive',
  Pending = 'pending',
}

// articleSchema covers: boolean, uri, guid, isoDate, array of items,
// nullable (allow null), description, and number greater/less validations.
export const articleSchema = z
  .object({
    id: z.uuid(),
    title: z.string().min(1).max(200),
    url: z.url(),
    isPublished: z.boolean(),
    publishedAt: z.iso.datetime(),
    tags: z.array(z.string()),
    rating: z.number().gt(0).lt(10).optional(),
    notes: z.string().nullable().optional(),
    summary: z.string().describe('A brief summary of the article').optional(),
  })
  .strict();

// memberSchema covers: alternatives/try (union), valid/enum via a TypeScript enum (optional),
// and valid/enum with .required() (both spread and literal forms).
export const memberSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    name: z.string().min(1),
    status: z.enum(MemberStatus),
    role: z.enum(['admin', 'editor', 'viewer']),
    preferredTheme: z.enum(['light', 'dark']).optional(),
  })
  .strict();

// addressSchema and orderItemSchema are sub-schemas used inside orderSchema to
// demonstrate complex nested schema composition.
const addressSchema = z
  .object({
    street: z.string().min(5),
    city: z.string().min(3),
    postalCode: z.string().regex(/^[a-zA-Z0-9]+$/),
  })
  .strict();

const orderItemSchema = z
  .object({
    productId: z.string().min(8),
    quantity: z.number().int().min(1),
    unitPrice: z.number().gt(0),
  })
  .strict();

// orderSchema is a complex schema that composes addressSchema and orderItemSchema,
// demonstrates pattern-to-record, and mixes required, optional, and nullable fields.
export const orderSchema = z
  .object({
    orderId: z.string().min(10).max(36),
    customerId: z.string().min(2),
    items: z.array(orderItemSchema),
    shippingAddress: addressSchema,
    discount: z.number().min(0).max(100).nullable().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
  })
  .strict();

// contactSchema covers the newly added transformations:
// email() → z.email(), domain() → hostname() → z.hostname(),
// hex() → z.hex(), base64() → z.base64(),
// case('lower') → toLowerCase(), and isoDuration() → z.iso.duration().
export const contactSchema = z
  .object({
    email: z.email(),
    website: z.hostname(),
    colorCode: z.hex(),
    avatar: z.base64().optional(),
    preferredUsername: z.string().toLowerCase(),
    sessionDuration: z.iso.duration().optional(),
  })
  .strict();

// callbackSchema demonstrates the func() → z.function() transformation.
export const callbackSchema = z.function();

export const auditSchema = z
  .object({
    createdAt: z.coerce.date(),
    reviewedAt: z.coerce.date().min(new Date('2020-01-01')),
  })
  .strict();

export const inventorySchema = z
  .object({
    sku: z.string().regex(/^[a-zA-Z0-9]+$/),
    checksum: z.hex().min(6),
    weight: z.number().transform(value => Number(value.toFixed(2))),
    servicePort: z.number().int().min(0).max(65535),
    warehouses: z.array(z.string()).refine(value => new Set(value).size === value.length),
    serialNumber: z.string().regex(/^[A-Z]{2}\d{6}$/),
  })
  .strict();

export const paymentSchema = z
  .object({
    cardToken: z.string().optional(),
    bankAccount: z.string().optional(),
  })
  .strict()
  .refine(value => [value['cardToken'], value['bankAccount']].filter(field => field !== undefined).length === 1)
  .optional();

export const shipmentSchema = z
  .object({
    method: z.enum(['express', 'ground']),
    trackingNumber: z.string().optional(),
  })
  .strict()
  .refine(value => !(value['method'] === 'express') || value['trackingNumber'] !== undefined, {
    message: '"trackingNumber" is required when the "when" condition holds',
    path: ['trackingNumber'],
  })
  .refine(value => value['method'] === 'express' || value['trackingNumber'] === undefined, {
    message: '"trackingNumber" is forbidden when the "when" condition does not hold',
    path: ['trackingNumber'],
  });

export const subscriptionSchema = z
  .object({
    seats: z.number().int(),
    plan: z.enum(['free', 'team']),
    billingEmail: z.email().optional(),

    purchaseOrder: z.string().optional(),
  })
  .strict()
  .refine(
    value =>
      !(value['seats'] !== undefined && z.number().min(2).safeParse(value['seats']).success) ||
      value['billingEmail'] !== undefined,
    { message: '"billingEmail" is required when the "when" condition holds', path: ['billingEmail'] },
  )
  .refine(
    value =>
      !(value['plan'] === 'team') ||
      (value['purchaseOrder'] !== undefined && z.string().min(4).safeParse(value['purchaseOrder']).success),
    { message: '"purchaseOrder" is valid when the "when" condition holds', path: ['purchaseOrder'] },
  );

export const registrationSchema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string(),
  })
  .strict()
  .refine(value => value['confirmPassword'] === value['password'], {
    message: 'passwords must match',
    path: ['confirmPassword'],
  });

export const couponSchema = z
  .object({
    code: z.string().transform(value => value.trim().toUpperCase()),
    referral: z
      .string()
      .transform((value, ctx) => {
        const helpers = {
          error: (code: unknown) => {
            ctx.addIssue({ code: 'custom', message: String(code) });
            return z.NEVER;
          },
          message: (text: unknown) => {
            ctx.addIssue({ code: 'custom', message: String(text) });
            return z.NEVER;
          },
        };

        return ((value, helpers) => {
          if (value.startsWith('EXPIRED')) return helpers.error('any.invalid');

          return value;
        })(value, helpers);
      })
      .optional(),
  })
  .strict();

// attachmentSchema covers binary() → instanceof(Buffer).
export const attachmentSchema = z
  .object({
    filename: z.string(),
    content: z.instanceof(Buffer),
  })
  .strict();

// premiumAccountSchema covers concat() → intersection().
export const premiumAccountSchema = z.intersection(
  z.object({ id: z.string() }).strict(),
  z.object({ tier: z.enum(['gold', 'platinum']) }).strict(),
);

// accessRequestSchema covers the remaining object relations: or, oxor, and, nand, with, and
// without (xor is already covered by paymentSchema above).
export const accessRequestSchema = z
  .object({
    email: z.string().optional(),
    phone: z.string().optional(),
    backupCode: z.string().optional(),
    recoveryQuestion: z.string().optional(),
    managerApproval: z.string().optional(),
    budgetCode: z.string().optional(),
    ticketId: z.string().optional(),
    approvalNote: z.string().optional(),
    isUrgent: z.boolean().optional(),
    escalationContact: z.string().optional(),
  })
  .strict()
  .refine(value => [value['email'], value['phone']].some(field => field !== undefined))
  .refine(value => [value['backupCode'], value['recoveryQuestion']].filter(field => field !== undefined).length <= 1)
  .refine(
    value =>
      [value['managerApproval'], value['budgetCode']].every(field => field !== undefined) ||
      [value['managerApproval'], value['budgetCode']].every(field => field === undefined),
  )
  .refine(value => ![value['ticketId'], value['approvalNote']].every(field => field !== undefined))
  .refine(value => value['isUrgent'] === undefined || [value['escalationContact']].every(field => field !== undefined))
  .refine(value => value['ticketId'] === undefined || [value['escalationContact']].every(field => field === undefined))
  .optional();
