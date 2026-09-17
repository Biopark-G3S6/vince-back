-- Restrict the immutable audit vocabulary to the two operations owned by this module.
ALTER TABLE "course"."course_coordinator_audit"
ADD CONSTRAINT "course_coordinator_audit_operation_check"
CHECK ("operation" IN ('ASSIGNED', 'REVOKED'));
