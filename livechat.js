const express = require('express');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const querystring = require('querystring');
const OAuth2 = require('oauth').OAuth2;

const app = express();

app.use(express.urlencoded({
    extended: true
}));

app.use(express.static(__dirname + '\\public'));


const config = {
    response_mode: 'form_post',
    url_authorize: 'https://accounts.haravan.com/connect/authorize',
    url_connect_token: 'https://accounts.haravan.com/connect/token',
    grant_type: 'authorization_code',
    nonce: 'abcd',
    response_type: 'code id_token',
    app_id: '11af125e2e2ccc414401970c53746ad6',
    app_secret: 'b54023a2103024e2cf4487d5b1ef9fa1b9b5ebe9a2131295f0a248a41abdd4bf',
    scope_login: 'openid profile email org userinfo',
    scope: 'openid profile email org userinfo web.write_script_tags com.write_products com.read_products grant_service',
    login_callback_url: 'http://localhost:8083/login',
    install_callback_url: 'http://localhost:8083/install'
};

app.get('/login/', (request, response) => {
    const orgId = request.query.orgid;
    const url = `${config.url_authorize}?response_mode=${config.response_mode}&response_type=${config.response_type}&scope=${config.scope_login}&client_id=${config.app_id}&redirect_uri=${config.login_callback_url}&nonce=${config.nonce}&orgid=${orgId}`;

    response.writeHead(301,
        { Location: url }
    );
    response.end();
});

app.post('/login/', (request, response) => {

    const decoded = jwt.decode(request.body.id_token);
    console.log(decoded);

    if (decoded.role.includes('admin')) {
        const url = `${config.url_authorize}?response_mode=${config.response_mode}&response_type=${config.response_type}&scope=${config.scope}&client_id=${config.app_id}&redirect_uri=${config.install_callback_url}&nonce=${config.nonce}&orgid=${decoded.orgid}`;

        response.writeHead(301,
            { Location: url }
        );
        response.end();

    } else {
        response.json({
            status: 'errorRole',
            data: 'Unauthorized'
        });
    }

});


app.post('/install/', (request, response) => {
    const params = {};
    params.grant_type = config.grant_type;
    params.redirect_uri = config.install_callback_url;

    const _oauth2 = new OAuth2(
        config.app_id,
        config.app_secret,
        '',
        config.url_authorize,
        config.url_connect_token,
        ''
    );

    _oauth2.getOAuthAccessToken(request.body.code, params, (err, accessToken, refreshToken, params) => {
        if (err) {
            const parseErrData = JSON.parse(err.data);
            console.log('error', parseErrData);
            response.json({
                errorOAuth: parseErrData
            });
        } else {
            console.log('accessToken', accessToken);
            const queryStringEncoded = querystring.escape(`http://localhost:8083/validate?accessToken=${accessToken}`);
            const destinationURL = `https://livechat.oncustomer.asia/integration?uri=${queryStringEncoded}`;

            response.writeHead(301, {
                Location: destinationURL
            });
            response.end();
        }
    });
});


app.get('/activate/', (request, response) => {
    const html = `<a href="http://localhost:8083/validate?accessToken=${request.query['accessToken']}&livechat_token=3bafd8ac4537f01d51027d1e30b00eb2">Activate</a>`;
    response.write(html);
    response.end();
});


app.get('/validate/', (request, response) => {
    const myHeaders = new fetch.Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", "Bearer " + request.query['accessToken']);

    const raw = JSON.stringify({
        "script_tag": {
            "event": "onload",
            "src": "https://lqaxx7799.github.io/livechat-script.js?token=" + request.query['livechat_token']
        }
    });

    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
        redirect: 'follow'
    };


    fetch("https://apis.haravan.com/web/script_tags.json", {
        headers: myHeaders
    })
        .then(res => res.json())
        .then(data => {
            const filteredData = data['script_tags'].filter(x => x.src.includes("https://lqaxx7799.github.io/livechat-script.js"));

            Promise.all(filteredData.map(tag => {
                return fetch("https://apis.haravan.com/web/script_tags/" + tag.id + ".json", {
                    method: 'DELETE',
                    headers: myHeaders
                });
            }))
                .then(result => {

                    fetch("https://apis.haravan.com/web/script_tags.json", requestOptions)
                        .then(res => res.json())
                        .then(result => {
                            const html = `
                                <link rel="stylesheet" type="text/css" href="/css/livechat.css" />
                                <div class="livechat-wrapper">
                                    <div class="livechat-content"><img class="livechat-logo" src="/images/logo.png" /></div>
                                    <div class="livechat-content">
                                        Kết nối ứng dụng với ứng dụng OnCustomer Livechat<br/>
                                        để bắt đầu chăm sóc khách hàng của bạn trên website.
                                    </div>
                                    <div class="livechat-content">
                                        <img class="livechat-icon" src="/images/check.png" />
                                        Bạn đã kết nối thành công với OnCustomer Livechat.
                                    </div>
                                    <div class="livechat-content">
                                        <a href="https://livechat.oncustomer.asia" target="_blank" class="livechat-button-outline">Dashboard</a>
                                    </div>
                                </div>
                            `;
                            response.writeHeader(200, {"Content-Type": "text/html; charset=utf-8"});  
                            response.write(html);
                            response.end();
                        })
                        .catch(error => response.json({ 'errorFetch': error }));
                });
        });

});

const server = app.listen(8083, () => {
    console.log('listening at 8083');
});