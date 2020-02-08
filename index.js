const comment = require(__dirname + '/modules/comment');
const config = require(__dirname + '/modules/config');
const validator = require('validator');
const sha1 = require('js-sha1');
const express = require('express');
const app = express();
const c = new comment();

const returnError = (res, status, msg) => {
    res.status(status).json({
        status: status,
        message: msg,
        data: {},
    });
}

// app.use(express.json());

app.get('/getComment/:articleId/:page?/:pageSize?', (req, res) => {
    let articleId = req.params.articleId || null;
    let page = req.params.page || 1;
    let pageSize = req.params.pageSize || 5;
    if (!validator.matches(articleId, /^[a-z\d]{40,40}$/g)) {
        returnError(res, 400, "Param(s) error!");
        return;
    }

    page = parseInt(page);
    pageSize = parseInt(pageSize);
    if (pageSize < 1) pageSize = 5;
    if (page < 1) page = 1;
    page = page - 1;

    c.getArticleComment(articleId, (data, error) => {
        if (error) {
            returnError(res, 500, "Server error: " + error.toString())
            return;
        }

        res.json({
            status: 200,
            message: "Success",
            data: data,
        });
    }, page, pageSize);
});

app.post('/addComment', (req, res) => {
    try {
        let body = req.body;
        if (!body) {
            throw new Error('Body not valid');
        }
        let articleId = body.articleId || null;
        let author = body.author;
        let email = body.email;
        let url = body.url || '';
        let content = body.content;
        let replyTo = body.replyTo || null;

        email = validator.normalizeEmail(email);
        content = validator.trim(content);
        content = validator.unescape(content);

        if (
            !validator.matches(articleId, /^[a-z\d]{40,40}$/g) &&
            !validator.matches(author, /^[\u4e00-\u9fa5a-zA-Z\w\d\ ]+$/g) &&
            !validator.isEmail(email) &&
            (!validator.isURL(url) || url === '') &&
            (content && content.length <= 500) &&
            (!validator.matches(replyTo, /^[a-z\d]{40,40}$/g) || replyTo === null)
        ) {
            returnError(res, 400, "Param(s) error!");
            return;
        }

        c.addArticleComment(articleId, author, email, url, content, (data, error) => {
            if (error) {
                returnError(res, 500, "Server error: " + error.toString())
                return;
            }

            res.json({
                status: 200,
                message: "Success",
                data: {},
            });
        }, replyTo);
    } catch (e) {
        returnError(res, 500, "Server error: " + e.toString());
    }
});

app.post('/createArticle', (req, res) => {
    try {
        let sysSecret = config['sysSecret'] || null;
        if (!sysSecret) {
            returnError(res, 500, "Secret havn't been set yet!");
            return;
        }

        sysSecret = sha1(sysSecret);
        let body = req.body;
        if (!body) {
            throw new Error('Body not valid');
        }
        let secret = body.secret;
        let title = body.title;
        let url = body.url;

        if (secret !== sysSecret) {
            returnError(res, 403, "Secret error!");
            return;
        }

        res.json({
            status: 200,
            message: "Success",
            data: {
                articleId: c.createArticleSync(title, url),
            },
        });
    } catch (e) {
        returnError(res, 500, "Server error: " + e.toString());
    }
});

app.all('*', (req, res) => {
    returnError(res, 404, "Not found");
});

app.listen(4500, () => console.log(`Example app listening on port 4500!`))