-- AlterTable
ALTER TABLE "members" DROP COLUMN "occupation";

-- CreateTable
CREATE TABLE "bio_data" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "former_nickname" VARCHAR(100),
    "gender" VARCHAR(20) NOT NULL,
    "set_year" SMALLINT NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "state" VARCHAR(120) NOT NULL,
    "country" VARCHAR(120) NOT NULL,
    "blood_group" VARCHAR(10) NOT NULL,
    "display_blood_group_on_id" BOOLEAN NOT NULL DEFAULT false,
    "occupation_category" VARCHAR(50) NOT NULL,
    "specialization" VARCHAR(255) NOT NULL,
    "membership_declaration" BOOLEAN NOT NULL,
    "data_privacy_consent" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bio_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bio_data_member_id_key" ON "bio_data"("member_id");

-- AddForeignKey
ALTER TABLE "bio_data" ADD CONSTRAINT "bio_data_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

