function path(value){if(typeof value!=='string'||!/^\/[A-Za-z0-9_./-]+$/.test(value)||value.split('/').some(x=>x==='..'))throw Error('证书路径无效');return value}
export function renderExamIngress({certificate,privateKey}){
 return `server {
    listen 18444 ssl;
    server_name exam.zenithjoy.tech;
    ssl_certificate ${path(certificate)};
    ssl_certificate_key ${path(privateKey)};
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 140m;
    access_log off;
    location / {
        proxy_pass http://127.0.0.1:18100;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_request_buffering off;
        proxy_buffering off;
        proxy_connect_timeout 10s;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }
}\n`;
}
