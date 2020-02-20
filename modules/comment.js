const CONFIG = require(__dirname + '/config');
const __root = __dirname + '/../data/';
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const objectHash = require('object-hash');
const PromiseQueue = require('promise-queue-plus');
let queue = PromiseQueue(1, {
    retry: 0,
    autoRun: true
});

class comment {
    getArticleComment(articleId, cb, page = null, pageSize = null) {
        this.getArticleFile(articleId, (data, error) => {
            if (error) {
                cb(null, error);
                return;
            }
            data = _.chunk(data.comments, (pageSize) ? pageSize : 20);
            if (data && data[page]) cb(data[page]);
            else cb([]);
        });
    }

    addArticleComment(articleId, author, email, url, content, cb, replyTo = null) {
        this.getArticleFile(articleId, (data, error) => {
            if (error) {
                cb(null, error);
                return;
            }
            let originComment = '';
            try {
                let data = this.getArticleFileSync(articleId);
                let comment = {
                    author: author,
                    email: email,
                    url: url,
                    commentTime: (new Date()).getTime(),
                    content: content,
                    childs: []
                };
                comment.commentId = objectHash(comment);

                if (replyTo) {
                    let target = data.comments;
                    let search = (arr) => {
                        for (let i in arr) {
                            let k = arr[i];
                            if (k.commentId === replyTo) return k;
                            if (k.childs.length) {
                                let result = search(k.childs);
                                if (_.isObject(result)) return result;
                            } else {
                                continue;
                            }
                        }
                    }

                    target = search(data.comments);
                    if (!target) {
                        cb(null, 'Specified comment not found');
                        return;
                    }
                    target.childs.unshift(comment);
                    originComment = target.content;
                } else {
                    data.comments.unshift(comment);
                }

                fs.writeFileSync(this.genFilename(articleId), JSON.stringify(data));
                cb(comment.commentId);

                if (CONFIG.replyNotification === 'true' && originComment) this.replyHook({
                    title: data.articleTitle,
                    time: (new Date).getTime(),
                    email: email,
                    author: author,
                    content: content,
                    originComment: originComment,
                }).then(_ => console.log(_));
            } catch (e) {
                cb(null, e.toString());
            }
        });
    }

    createArticleSync(title, url, articleId = null) {
        let articleData = {
            articleTitle: title,
            url: url,
            createTime: (new Date()).getTime(),
            comments: [],
        };
        articleData.articleId = articleId || objectHash(articleData);
        let filename = this.genFilename(articleData.articleId);

        if (!fs.existsSync(path.dirname(filename))) {
            fs.mkdirSync(path.dirname(filename), {
                recursive: true
            });
        }
        fs.writeFileSync(filename, JSON.stringify(articleData));

        return articleData.articleId;
    }

    getArticleFile(articleId, cb) {
        queue.add((resolve, reject) => {
            let filename = this.genFilename(articleId);
            if (!fs.existsSync(filename)) {
                reject('Article Id not found');
                return;
            }
            let data = fs.readFileSync(filename);
            if (!data) {
                reject(data);
                return;
            }
            data = JSON.parse(data);

            resolve(data);
        }).then((data) => cb(data), (error) => cb(null, error));
    }

    getArticleFileSync(articleId) {
        let filename = this.genFilename(articleId);
        if (!fs.existsSync(filename)) {
            throw new Error('Article Id not found');
        }
        let data = fs.readFileSync(filename);
        if (!data) {
            throw new Error('Data not valid');
        }
        data = JSON.parse(data);

        return data;
    }

    genFilename(hash) {
        return __root + hash.substr(0, 2) + '/' + hash.substr(-2, 2) + '/' + hash + '.json';
    }

    replyHook(data) {
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(CONFIG.sgApiKey);
        sgMail.setSubstitutionWrappers('{{', '}}');
        let date = new Date(data.time);

        const msg = {
            to: data.email,
            from: {
                name: CONFIG.sgFromName,
                email: CONFIG.sgFromEmail,
            },
            subject: CONFIG.sgSubjet,
            templateId: CONFIG.sgTemplateId,
            dynamic_template_data: {
                title: data.title,
                time: `${date.getFullYear()}-${date.getMonth()}-${date.getDay()} ${date.getHours()}:${date.getMinutes()}`,
                originComment: data.originComment,
                reply: data.content,
                year: date.getFullYear,
                author: data.author,
            },
        };

        return sgMail.send(msg);
    }
}

module.exports = comment;