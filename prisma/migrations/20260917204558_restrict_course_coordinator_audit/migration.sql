-- AddForeignKey
ALTER TABLE "course"."course_coordinator_audit" ADD CONSTRAINT "course_coordinator_audit_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course"."course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
