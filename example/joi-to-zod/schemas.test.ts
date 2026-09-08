import {
  userSchema,
  configSchema,
  articleSchema,
  memberSchema,
  orderSchema,
  contactSchema,
  callbackSchema,
  auditSchema,
  inventorySchema,
  paymentSchema,
  shipmentSchema,
  subscriptionSchema,
  registrationSchema,
  couponSchema,
  attachmentSchema,
  premiumAccountSchema,
  accessRequestSchema,
  enterpriseSchema,
} from './schemas';
import { enterpriseSchema as enterpriseZodSchema } from './schemas.zod';
import { validate } from './validate';

describe('userSchema', () => {
  test('accepts a valid user', () => {
    const result = validate(userSchema, { name: 'John', age: 30, email: 'john@example.com' });
    expect(result.valid).toBe(true);
  });

  test('rejects when required name is missing', () => {
    const result = validate(userSchema, { age: 30, email: 'john@example.com' });
    expect(result.valid).toBe(false);
  });

  test('rejects when required email is missing', () => {
    const result = validate(userSchema, { name: 'John', age: 30 });
    expect(result.valid).toBe(false);
  });

  test('accepts when optional age is missing', () => {
    const result = validate(userSchema, { name: 'John', email: 'john@example.com' });
    expect(result.valid).toBe(true);
  });

  test('rejects name shorter than minimum length', () => {
    const result = validate(userSchema, { name: 'J', age: 30, email: 'john@example.com' });
    expect(result.valid).toBe(false);
  });

  test('rejects name longer than maximum length', () => {
    const longName = 'a'.repeat(51);
    const result = validate(userSchema, { name: longName, age: 30, email: 'john@example.com' });
    expect(result.valid).toBe(false);
  });

  test('rejects non-integer age', () => {
    const result = validate(userSchema, { name: 'John', age: 25.5, email: 'john@example.com' });
    expect(result.valid).toBe(false);
  });

  test('rejects age below minimum', () => {
    const result = validate(userSchema, { name: 'John', age: -1, email: 'john@example.com' });
    expect(result.valid).toBe(false);
  });

  test('rejects age above maximum', () => {
    const result = validate(userSchema, { name: 'John', age: 151, email: 'john@example.com' });
    expect(result.valid).toBe(false);
  });

  test('rejects wrong type for name', () => {
    const result = validate(userSchema, { name: 123, age: 30, email: 'john@example.com' });
    expect(result.valid).toBe(false);
  });

  test('rejects wrong type for age', () => {
    const result = validate(userSchema, { name: 'John', age: 'thirty', email: 'john@example.com' });
    expect(result.valid).toBe(false);
  });
});

describe('configSchema', () => {
  test('accepts a valid config with string keys and number values', () => {
    const result = validate(configSchema, { timeout: 30, retries: 3 });
    expect(result.valid).toBe(true);
  });

  test('rejects when value is not a number', () => {
    const result = validate(configSchema, { timeout: 'thirty' });
    expect(result.valid).toBe(false);
  });

  test('accepts an empty config object', () => {
    const result = validate(configSchema, {});
    expect(result.valid).toBe(true);
  });
});

describe.each([
  { implementation: 'Joi', schema: enterpriseSchema },
  { implementation: 'Zod', schema: enterpriseZodSchema },
])('enterpriseSchema ($implementation)', ({ schema }) => {
  const validEnterpriseValue = {
    id: 'record-1',
    state: 'active',
    values: ['one', 2],
    metadata: { arbitrary: 'value' },
    count: 3,
  };

  test('accepts mixed array items and unconstrained metadata', () => {
    const result = validate(schema, validEnterpriseValue);
    expect(result.valid).toBe(true);
  });

  test('rejects a missing exist-aliased field', () => {
    const result = validate(schema, { ...validEnterpriseValue, id: undefined });
    expect(result.valid).toBe(false);
  });

  test('rejects a value outside an equal-aliased enum', () => {
    const result = validate(schema, { ...validEnterpriseValue, state: 'pending' });
    expect(result.valid).toBe(false);
  });

  test('rejects a not-aliased disallowed value', () => {
    const result = validate(schema, { ...validEnterpriseValue, count: 0 });
    expect(result.valid).toBe(false);
  });

  test('rejects unknown keys on a direct object shape', () => {
    const result = validate(schema, { ...validEnterpriseValue, unexpected: true });
    expect(result.valid).toBe(false);
  });
});

describe('articleSchema', () => {
  const validArticle = {
    id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    title: 'Hello World',
    url: 'https://example.com/articles/hello-world',
    isPublished: true,
    publishedAt: '2024-01-15T10:30:00.000Z',
    tags: ['typescript', 'zod'],
    rating: 8.5,
    notes: 'This is a note',
    summary: 'A brief summary',
  };

  test('accepts a valid article with all fields', () => {
    const result = validate(articleSchema, validArticle);
    expect(result.valid).toBe(true);
  });

  test('accepts a valid article with only required fields', () => {
    const result = validate(articleSchema, {
      id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      title: 'Hello World',
      url: 'https://example.com/articles/hello-world',
      isPublished: true,
      publishedAt: '2024-01-15T10:30:00.000Z',
      tags: ['typescript', 'zod'],
    });
    expect(result.valid).toBe(true);
  });

  test('rejects when required title is missing', () => {
    const result = validate(articleSchema, { ...validArticle, title: undefined });
    expect(result.valid).toBe(false);
  });

  test('rejects when url is not a valid URI', () => {
    const result = validate(articleSchema, { ...validArticle, url: 'not-a-url' });
    expect(result.valid).toBe(false);
  });

  test('rejects when id is not a valid UUID', () => {
    const result = validate(articleSchema, { ...validArticle, id: 'not-a-uuid' });
    expect(result.valid).toBe(false);
  });

  test('rejects when publishedAt is not an ISO date', () => {
    const result = validate(articleSchema, { ...validArticle, publishedAt: 'not-a-date' });
    expect(result.valid).toBe(false);
  });

  test('accepts when notes is null (nullable field)', () => {
    const result = validate(articleSchema, { ...validArticle, notes: null });
    expect(result.valid).toBe(true);
  });

  test('rejects when isPublished is not a boolean', () => {
    const result = validate(articleSchema, { ...validArticle, isPublished: 'yes' });
    expect(result.valid).toBe(false);
  });

  test('rejects rating at the lower exclusive boundary', () => {
    const result = validate(articleSchema, { ...validArticle, rating: 0 });
    expect(result.valid).toBe(false);
  });

  test('rejects rating at the upper exclusive boundary', () => {
    const result = validate(articleSchema, { ...validArticle, rating: 10 });
    expect(result.valid).toBe(false);
  });

  test('accepts rating within range', () => {
    const result = validate(articleSchema, { ...validArticle, rating: 5 });
    expect(result.valid).toBe(true);
  });

  test('rejects when tags is not an array', () => {
    const result = validate(articleSchema, { ...validArticle, tags: 'typescript' });
    expect(result.valid).toBe(false);
  });
});

describe('memberSchema', () => {
  const validMember = { id: 'member-abc', name: 'Alice', status: 'active', role: 'admin' };

  test('accepts with a string id', () => {
    const result = validate(memberSchema, validMember);
    expect(result.valid).toBe(true);
  });

  test('accepts with a number id', () => {
    const result = validate(memberSchema, { ...validMember, id: 42 });
    expect(result.valid).toBe(true);
  });

  test('rejects when required id is missing', () => {
    const result = validate(memberSchema, { name: 'Charlie', status: 'active', role: 'admin' });
    expect(result.valid).toBe(false);
  });

  test('rejects when id is not a string or number', () => {
    const result = validate(memberSchema, { ...validMember, id: {} });
    expect(result.valid).toBe(false);
  });

  test('accepts with a valid status enum value (required spread enum)', () => {
    const result = validate(memberSchema, { ...validMember, status: 'inactive' });
    expect(result.valid).toBe(true);
  });

  test('rejects when required status is missing', () => {
    const result = validate(memberSchema, { id: 'member-1', name: 'Eve', role: 'admin' });
    expect(result.valid).toBe(false);
  });

  test('rejects with an invalid status value', () => {
    const result = validate(memberSchema, { ...validMember, status: 'unknown' });
    expect(result.valid).toBe(false);
  });

  test('accepts with a valid role literal enum value (required literal enum)', () => {
    const result = validate(memberSchema, { ...validMember, role: 'editor' });
    expect(result.valid).toBe(true);
  });

  test('rejects when required role is missing', () => {
    const result = validate(memberSchema, { id: 'member-2', name: 'Bob', status: 'active' });
    expect(result.valid).toBe(false);
  });

  test('rejects with an invalid role value', () => {
    const result = validate(memberSchema, { ...validMember, role: 'superuser' });
    expect(result.valid).toBe(false);
  });

  test('accepts with a valid preferredTheme value', () => {
    const result = validate(memberSchema, { ...validMember, preferredTheme: 'dark' });
    expect(result.valid).toBe(true);
  });

  test('rejects with an invalid preferredTheme value', () => {
    const result = validate(memberSchema, { ...validMember, preferredTheme: 'solarized' });
    expect(result.valid).toBe(false);
  });
});

describe('orderSchema', () => {
  const validOrder = {
    orderId: 'ORD-001-2024',
    customerId: 'CUST01',
    items: [{ productId: 'PROD-0001', quantity: 2, unitPrice: 19.99 }],
    shippingAddress: { street: '123 Main St', city: 'Springfield', postalCode: 'abc123' },
  };

  test('accepts a valid order', () => {
    const result = validate(orderSchema, validOrder);
    expect(result.valid).toBe(true);
  });

  test('rejects when required orderId is missing', () => {
    const result = validate(orderSchema, { ...validOrder, orderId: undefined });
    expect(result.valid).toBe(false);
  });

  test('rejects when required items array is missing', () => {
    const result = validate(orderSchema, { ...validOrder, items: undefined });
    expect(result.valid).toBe(false);
  });

  test('rejects when items is not an array', () => {
    const result = validate(orderSchema, { ...validOrder, items: 'not-an-array' });
    expect(result.valid).toBe(false);
  });

  test('rejects when item quantity is below minimum', () => {
    const result = validate(orderSchema, {
      ...validOrder,
      items: [{ productId: 'PROD-0001', quantity: 0, unitPrice: 19.99 }],
    });
    expect(result.valid).toBe(false);
  });

  test('rejects when item unitPrice is not greater than zero', () => {
    const result = validate(orderSchema, {
      ...validOrder,
      items: [{ productId: 'PROD-0001', quantity: 1, unitPrice: 0 }],
    });
    expect(result.valid).toBe(false);
  });

  test('accepts when discount is null (nullable field)', () => {
    const result = validate(orderSchema, { ...validOrder, discount: null });
    expect(result.valid).toBe(true);
  });

  test('rejects when discount exceeds maximum', () => {
    const result = validate(orderSchema, { ...validOrder, discount: 101 });
    expect(result.valid).toBe(false);
  });

  test('accepts with metadata as a record of strings', () => {
    const result = validate(orderSchema, { ...validOrder, metadata: { source: 'web', channel: 'email' } });
    expect(result.valid).toBe(true);
  });

  test('rejects when shipping address postalCode is not alphanumeric', () => {
    const result = validate(orderSchema, {
      ...validOrder,
      shippingAddress: { street: '123 Main St', city: 'Springfield', postalCode: 'abc-123' },
    });
    expect(result.valid).toBe(false);
  });
});

describe('contactSchema', () => {
  const validContact = {
    email: 'user@example.com',
    website: 'example.com',
    colorCode: 'ff0000',
    avatar: 'SGVsbG8gV29ybGQ=',
    preferredUsername: 'john',
    sessionDuration: 'P1Y2M3D',
  };

  test('accepts a valid contact with all fields', () => {
    const result = validate(contactSchema, validContact);
    expect(result.valid).toBe(true);
  });

  test('accepts when optional fields are missing', () => {
    const result = validate(contactSchema, {
      email: 'user@example.com',
      website: 'example.com',
      colorCode: 'ff0000',
      preferredUsername: 'alice',
    });
    expect(result.valid).toBe(true);
  });

  test('rejects when required email is missing', () => {
    const result = validate(contactSchema, { ...validContact, email: undefined });
    expect(result.valid).toBe(false);
  });

  test('rejects when email is not a valid email address', () => {
    const result = validate(contactSchema, { ...validContact, email: 'not-an-email' });
    expect(result.valid).toBe(false);
  });

  test('rejects when required website is missing', () => {
    const result = validate(contactSchema, { ...validContact, website: undefined });
    expect(result.valid).toBe(false);
  });

  test('rejects when website is not a valid domain', () => {
    const result = validate(contactSchema, { ...validContact, website: 'not a domain!' });
    expect(result.valid).toBe(false);
  });

  test('rejects when required colorCode is missing', () => {
    const result = validate(contactSchema, { ...validContact, colorCode: undefined });
    expect(result.valid).toBe(false);
  });

  test('rejects when colorCode is not a valid hex string', () => {
    const result = validate(contactSchema, { ...validContact, colorCode: 'gggggg' });
    expect(result.valid).toBe(false);
  });

  test('rejects when avatar is not a valid base64 string', () => {
    const result = validate(contactSchema, { ...validContact, avatar: '!!!not-base64!!!' });
    expect(result.valid).toBe(false);
  });

  test('rejects when required preferredUsername is missing', () => {
    const result = validate(contactSchema, { ...validContact, preferredUsername: undefined });
    expect(result.valid).toBe(false);
  });

  test('accepts a lowercase preferredUsername', () => {
    const result = validate(contactSchema, { ...validContact, preferredUsername: 'alice' });
    expect(result.valid).toBe(true);
  });

  test('accepts an uppercase preferredUsername (case is normalised)', () => {
    const result = validate(contactSchema, { ...validContact, preferredUsername: 'ALICE' });
    expect(result.valid).toBe(true);
  });

  test('rejects when sessionDuration is not a valid ISO 8601 duration', () => {
    const result = validate(contactSchema, { ...validContact, sessionDuration: 'not-a-duration' });
    expect(result.valid).toBe(false);
  });
});

describe('callbackSchema', () => {
  test('accepts a function value', () => {
    const result = validate(callbackSchema, () => {});
    expect(result.valid).toBe(true);
  });

  test('rejects a non-function value', () => {
    const result = validate(callbackSchema, 'not a function');
    expect(result.valid).toBe(false);
  });
});

describe('auditSchema', () => {
  const validAudit = { createdAt: '2024-03-01T10:00:00.000Z', reviewedAt: '2024-03-02T10:00:00.000Z' };

  test('accepts ISO date strings', () => {
    const result = validate(auditSchema, validAudit);
    expect(result.valid).toBe(true);
  });

  test('accepts Date instances', () => {
    const result = validate(auditSchema, { createdAt: new Date(), reviewedAt: new Date('2021-01-01') });
    expect(result.valid).toBe(true);
  });

  test('rejects a value that is not a date', () => {
    const result = validate(auditSchema, { ...validAudit, createdAt: 'not-a-date' });
    expect(result.valid).toBe(false);
  });

  test('rejects a reviewedAt before the minimum', () => {
    const result = validate(auditSchema, { ...validAudit, reviewedAt: '2019-01-01T00:00:00.000Z' });
    expect(result.valid).toBe(false);
  });
});

describe('inventorySchema', () => {
  const validInventory = {
    sku: 'ABC123',
    checksum: 'ff00aa',
    weight: 1.23,
    servicePort: 8080,
    warehouses: ['north', 'south'],
    serialNumber: 'AB123456',
  };

  test('accepts a valid inventory record', () => {
    const result = validate(inventorySchema, validInventory);
    expect(result.valid).toBe(true);
  });

  test('accepts an uppercase alphanumeric sku', () => {
    const result = validate(inventorySchema, { ...validInventory, sku: 'ZZTOP99' });
    expect(result.valid).toBe(true);
  });

  test('rejects a sku with a separator', () => {
    const result = validate(inventorySchema, { ...validInventory, sku: 'abc-123' });
    expect(result.valid).toBe(false);
  });

  test('rejects a checksum that is not hexadecimal', () => {
    const result = validate(inventorySchema, { ...validInventory, checksum: 'zzzzzz' });
    expect(result.valid).toBe(false);
  });

  test('rejects a checksum shorter than the minimum', () => {
    const result = validate(inventorySchema, { ...validInventory, checksum: 'ff0' });
    expect(result.valid).toBe(false);
  });

  test('accepts a weight with more precision than allowed', () => {
    const result = validate(inventorySchema, { ...validInventory, weight: 1.234 });
    expect(result.valid).toBe(true);
  });

  test('rejects a port above the valid range', () => {
    const result = validate(inventorySchema, { ...validInventory, servicePort: 70000 });
    expect(result.valid).toBe(false);
  });

  test('rejects duplicate warehouses', () => {
    const result = validate(inventorySchema, { ...validInventory, warehouses: ['north', 'north'] });
    expect(result.valid).toBe(false);
  });

  test('accepts a serialNumber matching the required format', () => {
    const result = validate(inventorySchema, { ...validInventory, serialNumber: 'AB123456' });
    expect(result.valid).toBe(true);
  });

  test('rejects a serialNumber not matching the required format', () => {
    const result = validate(inventorySchema, { ...validInventory, serialNumber: 'invalid' });
    expect(result.valid).toBe(false);
  });
});

describe('paymentSchema', () => {
  test('accepts exactly one payment method', () => {
    const result = validate(paymentSchema, { cardToken: 'tok_123' });
    expect(result.valid).toBe(true);
  });

  test('rejects both payment methods together', () => {
    const result = validate(paymentSchema, { cardToken: 'tok_123', bankAccount: 'acc_456' });
    expect(result.valid).toBe(false);
  });

  test('rejects neither payment method', () => {
    const result = validate(paymentSchema, {});
    expect(result.valid).toBe(false);
  });
});

describe('shipmentSchema', () => {
  test('accepts an express shipment with a tracking number', () => {
    const result = validate(shipmentSchema, { method: 'express', trackingNumber: 'TRK123' });
    expect(result.valid).toBe(true);
  });

  test('rejects an express shipment without a tracking number', () => {
    const result = validate(shipmentSchema, { method: 'express' });
    expect(result.valid).toBe(false);
  });

  test('accepts a ground shipment without a tracking number', () => {
    const result = validate(shipmentSchema, { method: 'ground' });
    expect(result.valid).toBe(true);
  });

  test('rejects a ground shipment that carries a tracking number', () => {
    const result = validate(shipmentSchema, { method: 'ground', trackingNumber: 'TRK123' });
    expect(result.valid).toBe(false);
  });
});

describe('subscriptionSchema', () => {
  const validSubscription = { seats: 1, plan: 'free' };

  test('accepts a single seat on the free plan', () => {
    const result = validate(subscriptionSchema, validSubscription);
    expect(result.valid).toBe(true);
  });

  test('requires a billing email once there is more than one seat', () => {
    const result = validate(subscriptionSchema, { ...validSubscription, seats: 4 });
    expect(result.valid).toBe(false);
  });

  test('accepts multiple seats with a billing email', () => {
    const result = validate(subscriptionSchema, { ...validSubscription, seats: 4, billingEmail: 'a@b.co' });
    expect(result.valid).toBe(true);
  });

  test('requires a purchase order on the team plan', () => {
    const result = validate(subscriptionSchema, { seats: 1, plan: 'team' });
    expect(result.valid).toBe(false);
  });

  test('rejects a purchase order that is too short on the team plan', () => {
    const result = validate(subscriptionSchema, { seats: 1, plan: 'team', purchaseOrder: 'ab' });
    expect(result.valid).toBe(false);
  });

  test('accepts a valid purchase order on the team plan', () => {
    const result = validate(subscriptionSchema, { seats: 1, plan: 'team', purchaseOrder: 'PO-1234' });
    expect(result.valid).toBe(true);
  });

  test('ignores the purchase order rule on the free plan', () => {
    const result = validate(subscriptionSchema, { ...validSubscription, purchaseOrder: 'ab' });
    expect(result.valid).toBe(true);
  });
});

describe('registrationSchema', () => {
  test('accepts matching passwords', () => {
    const result = validate(registrationSchema, { password: 'hunter2!', confirmPassword: 'hunter2!' });
    expect(result.valid).toBe(true);
  });

  test('rejects mismatched passwords', () => {
    const result = validate(registrationSchema, { password: 'hunter2!', confirmPassword: 'hunter3!' });
    expect(result.valid).toBe(false);
  });

  test('rejects a password shorter than the minimum', () => {
    const result = validate(registrationSchema, { password: 'short', confirmPassword: 'short' });
    expect(result.valid).toBe(false);
  });
});

describe('couponSchema', () => {
  test('accepts a coupon code', () => {
    const result = validate(couponSchema, { code: ' save20 ' });
    expect(result.valid).toBe(true);
  });

  test('rejects a missing coupon code', () => {
    const result = validate(couponSchema, {});
    expect(result.valid).toBe(false);
  });

  test('accepts a live referral code', () => {
    const result = validate(couponSchema, { code: 'SAVE20', referral: 'FRIEND1' });
    expect(result.valid).toBe(true);
  });

  test('rejects an expired referral code', () => {
    const result = validate(couponSchema, { code: 'SAVE20', referral: 'EXPIRED1' });
    expect(result.valid).toBe(false);
  });
});

describe('attachmentSchema', () => {
  test('accepts a Buffer for content', () => {
    const result = validate(attachmentSchema, { filename: 'report.pdf', content: Buffer.from('hello') });
    expect(result.valid).toBe(true);
  });

  test('rejects a non-buffer value for content', () => {
    const result = validate(attachmentSchema, { filename: 'report.pdf', content: 12345 });
    expect(result.valid).toBe(false);
  });
});

describe('premiumAccountSchema', () => {
  test('accepts an object satisfying both intersected schemas', () => {
    const result = validate(premiumAccountSchema, { id: 'abc', tier: 'gold' });
    expect(result.valid).toBe(true);
  });

  test('rejects when the intersected field is missing', () => {
    const result = validate(premiumAccountSchema, { id: 'abc' });
    expect(result.valid).toBe(false);
  });

  test('rejects when the intersected field has an invalid value', () => {
    const result = validate(premiumAccountSchema, { id: 'abc', tier: 'bronze' });
    expect(result.valid).toBe(false);
  });
});

describe('accessRequestSchema', () => {
  const validRequest = { email: 'a@b.com' };

  test('accepts a baseline request satisfying every relation', () => {
    const result = validate(accessRequestSchema, validRequest);
    expect(result.valid).toBe(true);
  });

  test('or: rejects when neither email nor phone is present', () => {
    const result = validate(accessRequestSchema, {});
    expect(result.valid).toBe(false);
  });

  test('oxor: rejects when both backupCode and recoveryQuestion are present', () => {
    const result = validate(accessRequestSchema, {
      ...validRequest,
      backupCode: 'x',
      recoveryQuestion: 'y',
    });
    expect(result.valid).toBe(false);
  });

  test('and: rejects when only one of managerApproval and budgetCode is present', () => {
    const result = validate(accessRequestSchema, { ...validRequest, managerApproval: 'approved' });
    expect(result.valid).toBe(false);
  });

  test('nand: rejects when both ticketId and approvalNote are present', () => {
    const result = validate(accessRequestSchema, { ...validRequest, ticketId: 't-1', approvalNote: 'note' });
    expect(result.valid).toBe(false);
  });

  test('nand: accepts when only ticketId is present', () => {
    const result = validate(accessRequestSchema, { ...validRequest, ticketId: 't-1' });
    expect(result.valid).toBe(true);
  });

  test('with: rejects isUrgent without an escalationContact', () => {
    const result = validate(accessRequestSchema, { ...validRequest, isUrgent: true });
    expect(result.valid).toBe(false);
  });

  test('with: accepts isUrgent alongside an escalationContact', () => {
    const result = validate(accessRequestSchema, {
      ...validRequest,
      isUrgent: true,
      escalationContact: 'oncall@example.com',
    });
    expect(result.valid).toBe(true);
  });

  test('without: rejects ticketId alongside an escalationContact', () => {
    const result = validate(accessRequestSchema, {
      ...validRequest,
      ticketId: 't-1',
      escalationContact: 'oncall@example.com',
    });
    expect(result.valid).toBe(false);
  });
});
