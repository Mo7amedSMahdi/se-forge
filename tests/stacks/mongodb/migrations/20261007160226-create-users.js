/**
 * The users collection: a JSON-schema validator (the database enforces the shape) and the indexes
 * the queries need: unique email, and the list order (newest first, then _id).
 * @param db {import('mongodb').Db}
 */
export const up = async (db) => {
  await db.createCollection('users', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['email', 'displayName', 'status', 'createdAt'],
        additionalProperties: false,
        properties: {
          _id: { bsonType: 'objectId' },
          email: { bsonType: 'string', maxLength: 254 },
          displayName: { bsonType: 'string', minLength: 1, maxLength: 100 },
          status: { enum: ['ACTIVE', 'SUSPENDED'] },
          createdAt: { bsonType: 'date' },
        },
      },
    },
    validationAction: 'error',
  });
  await db.collection('users').createIndex({ email: 1 }, { unique: true, name: 'ux_users_email' });
  await db.collection('users').createIndex({ createdAt: -1, _id: -1 }, { name: 'ix_users_created_at_id' });
};

/** @param db {import('mongodb').Db} */
export const down = async (db) => {
  await db.collection('users').drop();
};
