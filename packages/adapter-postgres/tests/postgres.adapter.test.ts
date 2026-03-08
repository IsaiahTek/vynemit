import { PostgresStorageAdapter } from '../src/postgres_storage_adapter';

describe('PostgresStorageAdapter', () => {
    it('should be defined', () => {
        expect(PostgresStorageAdapter).toBeDefined();
    });

    it('should instantiate correctly', () => {
        const adapter = new PostgresStorageAdapter({
            connectionString: 'postgresql://localhost:5432/test'
        });
        expect(adapter).toBeDefined();
    });
});
