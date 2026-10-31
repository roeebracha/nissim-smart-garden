-- AlterEnum
-- Human approval (decision #2). The LLM module still inserts only `pending`.
-- Postgres 12+ allows ADD VALUE inside the migration transaction. This
-- migration does not use the new value in the same statement.
ALTER TYPE "SuggestionStatus" ADD VALUE 'approved';
