-- AlterTable: members — add permanent membership number.
ALTER TABLE "members" ADD COLUMN "membership_number" VARCHAR(30);

-- CreateIndex: unique membership number for lookup.
CREATE UNIQUE INDEX "members_membership_number_key" ON "members"("membership_number");

-- AlterTable: graduation_sets — add the per-set sequential counter for the
-- membership number (atomically incremented with UPDATE ... RETURNING).
ALTER TABLE "graduation_sets" ADD COLUMN "next_member_seq" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: bio_data — blood group now always shows on the ID card, so the
-- opt-out column is gone.
ALTER TABLE "bio_data" DROP COLUMN "display_blood_group_on_id";