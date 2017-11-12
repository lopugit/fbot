var conf = {
    appId: '1947192202193888',
    appSecret: '67c3f771bd0e4b1191fdb85a45861915',
    redirect_uri: 'http://localhost:5555/',
    postEdges: ["likes", "sharedposts", "attachments", "reactions", "comments"],
    commentEdges: ["likes", "reactions", "comments"],
    accessToken: function() { return (conf.appId + "|" + conf.appSecret) }
}

module.exports = conf