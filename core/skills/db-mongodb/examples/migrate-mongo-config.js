// migrate-mongo: versioned up/down scripts for collections, validators, indexes and data changes
// (decision 38). The connection comes from the environment, never from this file.
const config = {
  mongodb: {
    url: process.env.MONGODB_URL ?? 'mongodb://localhost:27017',
    databaseName: process.env.MONGODB_DB ?? 'app',
    options: {},
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',
  lockCollectionName: 'changelog_lock',
  lockTtl: 0,
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'esm',
};
export default config;
