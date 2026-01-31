import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { expect } from 'chai';

type PhotoMetadata = {
    filename: string;
    caption?: string;
    tags?: string[];
};

// helper to create a FormData instance for uploading photos
export async function createPhotoForm(files: string[], metadata?: PhotoMetadata[]) {
    const form = new FormData();

    if (metadata) {
        form.append('metadata', JSON.stringify({ items: metadata }));
    }

    for (const filePath of files) {
        form.append('file', fs.createReadStream(filePath));
    }

    return form;
}

// helper to assert a successful photo upload
export function assertPhotoUpload(response: any, uploadsDir: string, photoIds: string[]) {
    expect(response.statusCode).to.equal(201);

    const body = response.json();
    expect(body).to.have.property('photos');
    expect(Array.isArray(body.photos)).to.be.true;

    // check that each image was saved to /uploads
    for (const photo of body.photos) {
        expect(photo).to.have.property('id');
        expect(photo).to.have.property('file_path');
        expect(
            fs.existsSync(
                path.join(uploadsDir, photo.file_path)
            )
        ).to.be.true;

        photoIds.push(photo.id);
    }
    return body.photos;
}

// helper to perform GET /photos with optional query params
export async function getPhotos(app: any, userId: string, query?: any) {
    let url = '/photos';
    if (query) {
        const queryString = new URLSearchParams(query).toString();
        url += `?${queryString}`;
    }

    return app.inject({
        method: 'GET',
        url,
        headers: { 'x-user-id': userId },
    });
}

