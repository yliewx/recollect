import { PrismaClient } from "@/generated/prisma/client.js";
import { InsertedPhotoData } from "./photo.upload.js";
import { Caption } from "@/types/models.js";

export class CaptionService {
    constructor(private prisma: PrismaClient) {}

    private hasCaption(photo: InsertedPhotoData): boolean {
        return typeof photo.caption === 'string' && photo.caption.trim() !== '';
    }

    async insertCaptions(photoData: InsertedPhotoData[]) {
        // filter out photos without captions
        const captionData = photoData
            .filter(photo => this.hasCaption(photo))
            .map(({ photo_id, caption }) => ({ photo_id, caption: caption! }));
        
        if (captionData.length === 0) return;

        return await this.prisma.captions.createManyAndReturn({
            data: captionData,
            skipDuplicates: true,
        });
    }

    async updateCaption(photo_id: bigint, caption: string) {
        return this.prisma.captions.upsert({
            where: { photo_id },
            create: {
                photo_id,
                caption
            },
            update: { caption }
        });
    }
}
