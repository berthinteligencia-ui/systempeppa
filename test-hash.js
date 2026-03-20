const bcrypt = require('bcryptjs');
const hash = '$2b$10$CtlYEf9heB.zGKJP1SnxreLN61zO0bOt7b3zTA5rPYlbjbOH2Xg4W';
const password = 'admin123';

bcrypt.compare(password, hash).then(result => {
    console.log('Match:', result);
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
