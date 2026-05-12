
const username = document.getElementById('username');
const password = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const statusReport = document.getElementById('msg');

const loginUrl = '/loginUser';

document.addEventListener('DOMContentLoaded', () => {

    loginBtn.addEventListener('click', login);
});


// signup function
// function to send stuff from front to back
async function login(e) {
    e.preventDefault();
    if (username.value == '' || password.value == '') return;

    let res;
    try {
        res = await fetch(loginUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username.value,
                password: password.value
            })
        });
    } catch (error) {
        statusReport.innerHTML = 'Could not reach server';
        statusReport.style.color = 'red';
        return;
    }

    if (res.ok || res.status == 300){

        let data = {};
        try {
            data = await res.json();
        } catch (error) {
            data = {};
        }
        window.location.assign(data.redirect || '/bank');

        username.value = '';
        password.value = '';

    }
    // if username is not found in db
    else if (res.status == 404){
        username.value = '';
        password.value = '';
        
        alert('Invalid credentials / User not found!');
        statusReport.innerHTML = 'Invalid credentials / User not found';
        statusReport.style.color = 'red';
    }
    
    // invalid password
    else if (res.status == 403){
        username.value = '';
        password.value = '';

        alert('Invalid password!');
        statusReport.innerHTML = 'Invalid password';
        statusReport.style.color = 'red';
    }

}
