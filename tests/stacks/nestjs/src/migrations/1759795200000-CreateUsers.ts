import { MigrationInterface, QueryRunner } from 'typeorm';

/** Migrations are written in SQL (decision 36), one logical change each, with a down. */
export class CreateUsers1759795200000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE users (
        id CHAR(36) NOT NULL,
        email VARCHAR(254) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY ux_users_email (email),
        KEY ix_users_created_at_id (created_at DESC, id DESC),
        CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE', 'SUSPENDED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE users');
  }
}
