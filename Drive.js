const async = require('async');
const to = require("await-to-js").default;
const Configstore = require('configstore');
const packageJson = require('./package.json');
const _ = require("lodash")
const config = new Configstore(packageJson.name);
const {
    google
} = require("googleapis");
class Drive {
    constructor(oAuth2Client) {
        this.drive = google.drive({
            version: "v3",
            auth: oAuth2Client
        });
    }


    setQuery(query) {
        this.query = query
    }

    // Search folder của từng dự án
    searchChildFolderByName(parentId, folderName) {

        return new Promise((resolve, reject) => {
            this.drive.files.list({
                q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${folderName}'`,
                fields: 'nextPageToken, files(id, name)',
                spaces: 'drive'
            }, function (err, res) {
                if (err) {
                    reject(err);
                } else {
                    let folder = _.get(res, "data.files[0].id", "")
                    resolve(folder)
                }
            });
        })
    }

    filterByPage(folderId, pageToken) {
        return new Promise((resolve, reject) => {
            this.drive.files.list({
                q: `'${folderId}' in parents`,
                fields: 'nextPageToken, files(id, name)',
                spaces: 'drive',
                pageToken: pageToken
            }, function (err, res) {
                if (err) {
                    reject(err);
                } else {
                    resolve(res.data)
                }
            });
        })
    }

    async getProjectFolderId(token) {
        let authToken = config.get("authToken") || {};
        let folderName = authToken[token];
        if (!folderName) {
            return {
                error: true,
                message: "sai token",
                status: 401
            };
        }
        let rootFolderId = config.get("rootFolderId")
        // get ra folder của dự án
        let [error, projectFolderId] = await to(this.searchChildFolderByName(rootFolderId, folderName));
        if (error) {
            return {
                error: true,
                status: 500,
                message: error
            }
        }
        return projectFolderId;
    }

    async getAllFilesByChildFolder(parentFolderId, folderName) {
        let allFiles = []
        let pageToken = null;
        let [error, ImageFolderId] = await to(this.searchChildFolderByName(parentFolderId, folderName));
        if (error) {
            return {
                error: true,
                status: 500,
                message: error
            }
        }
        if (!ImageFolderId) return []
        do {
            let [error, data = {}] = await to(this.filterByPage(ImageFolderId, pageToken));
            pageToken = data.nextPageToken;
            allFiles = allFiles.concat(data.files || []);
        } while (pageToken);
        return allFiles;
    }
    async getAllVideos({
        token
    }) {
        let projectFolderId = await this.getProjectFolderId(token) || {};
        // lỗi auth do sai token
        if (projectFolderId.error) {
            return projectFolderId;
        }
        // lấy ra hết files trong thư mục images
        let allFiles = [];
        if (projectFolderId) {
            allFiles = await this.getAllFilesByChildFolder(projectFolderId, "videos")
        }

        return allFiles;
    }
    async uploadFile({
        token,
        folder,
        fileMetadata,
        media
    }) {
        let projectFolderId = await this.getProjectFolderId(token) || {};
        // lỗi auth do sai token
        if (projectFolderId.error) {
            return projectFolderId;
        }
        let storedFolderId = await this.searchChildFolderByName(projectFolderId, folder);
        if (storedFolderId) {
            fileMetadata.parents = [storedFolderId]
            let [err, result] = await to(this.insertOneFile({
                fileMetadata,
                media
            }))
            if(err){
                return {
                    error: true,
                    status: 500,
                    message: err
                }
            }
            return result
        }
        return {
            error: true,
            status: 500,
            message: "Không tồn tại thư mục " + folder
        }
    }

    async insertOneFile({
        fileMetadata,
        media
    }) {

        return new Promise((resolve, reject) => {
            this.drive.files.create({
                    resource: fileMetadata,
                    media: media,
                    fields: "id",
                },
                (err, res) => {
                    if (err) {
                        // Handle error
                        reject(err)
                    } else {
                        resolve(res.data)
                    }
                })
        })
    }
    async getAllImages({
        token
    }) {
        let projectFolderId = await this.getProjectFolderId(token) || {};
        // lỗi auth do sai token
        if (projectFolderId.error) {
            return projectFolderId;
        }
        // lấy ra hết files trong thư mục images
        let allFiles = [];
        if (projectFolderId) {
            allFiles = await this.getAllFilesByChildFolder(projectFolderId, "images")
        }

        return allFiles;
    }
}
module.exports = Drive;