import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'users' })
export class User {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  displayName: string;

  @Column({ type: 'varchar', length: 20 })
  status: 'ACTIVE' | 'SUSPENDED';

  @Column({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
    insert: false,
    update: false,
  })
  createdAt: Date;
}
