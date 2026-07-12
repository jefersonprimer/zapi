-- Add deleted_by_caller and deleted_by_callee columns to call_logs
ALTER TABLE call_logs ADD COLUMN deleted_by_caller BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE call_logs ADD COLUMN deleted_by_callee BOOLEAN NOT NULL DEFAULT FALSE;
