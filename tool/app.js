const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const crypto = require('crypto');
const objectHash = require('object-hash');
const mapping = {
    59: '/messages/',
    1390: '/read/robomaster-2019.html',
    1336: '/read/portainer.html',
    1303: '/read/cloudman.html',
    1226: '/read/smart-card-reconstruction-project.html',
    1193: '/read/smartcard.html',
    1172: '/read/2018-annual-briefing.html',
    1144: '/read/one.html',
    1129: '/read/qq2tg.html',
    1113: '/read/oneplus6.html',
    1114: '/read/fuck-aihuishou.html',
    1098: '/read/ticwatch-s.html',
    1088: '/read/loli.html',
    1032: '/read/airpods.html',
    1021: '/read/notepad.html',

}

let finComment = {};
let data = fs.readFileSync(__dirname + '/comments.json');
if (!data || !JSON.parse(data)) throw new Error('Not a valid JSON file.');
data = JSON.parse(data)[2].data;

const genCommentId = (postId, commentId) => {
    return objectHash({
        commentId: postId,
        commentId: commentId,
        verify: parseInt(postId) * parseInt(commentId),
    });
}

const genFilename = (hash) => {
    return __dirname + '/output/' + hash.substr(0, 2) + '/' + hash.substr(-2, 2) + '/' + hash + '.json';
}

const search = (arr, replyTo) => {
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

for (let i in data)
{
    let comment = data[i];
    if (!(
        mapping[comment.comment_post_ID] &&
        comment.comment_approved === '1' &&
        comment.comment_karma === '0'
    )) continue;

    let md5 = crypto.createHash('md5').update(mapping[comment.comment_post_ID]).digest('hex');
    let articleId = objectHash({id: md5});
    // console.log(comment);

    if (!finComment[articleId]) finComment[articleId] = {articleId: articleId, comments: []}
    let arr = finComment[articleId].comments;
    let commentBody = {
        commentId: "",
        author: comment.comment_author,
        email: comment.comment_author_email,
        url: comment.comment_author_url,
        commentTime: (new Date(comment.comment_date)).getTime(),
        content: comment.comment_content,
        childs: []
    }
    commentBody.commentId = genCommentId(comment.comment_post_ID, comment.comment_ID);

    if (comment.comment_parent !== '0')
    {
        let result = search(arr, genCommentId(comment.comment_post_ID, comment.comment_parent));
        if (result) result.childs.unshift(commentBody);
    } else {
        arr.unshift(commentBody);
    }
}

fs.writeFileSync(__dirname + '/output/data.json', JSON.stringify(finComment));

for (let i in finComment)
{
    let filename = genFilename(i);
    fs.mkdirSync(path.dirname(filename), {recursive: true});
    fs.writeFileSync(filename, JSON.stringify(finComment[i]));
}