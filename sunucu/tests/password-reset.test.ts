import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import {memoryAdapter} from 'better-auth/adapters/memory';
import {toNodeHandler} from 'better-auth/node';
import {createAuth} from '../src/auth.js';
function fixture(){
 const database:Record<string,any[]>={user:[],session:[],account:[],verification:[],rateLimit:[]};
 const mails:{email:string;token:string}[]=[];
 const config={baseUrl:'http://localhost:3000',secret:'password-reset-test-secret-not-for-production-123456',databaseUrl:'test',webOrigins:['http://localhost:4280']};
 const auth=createAuth(memoryAdapter(database),config,{sendPasswordReset:async({user,token})=>{mails.push({email:user.email,token});}});
 const app=express();app.all('/api/auth/*splat',toNodeHandler(auth));
 return {app,database,mails};
}
test('password recovery uses one-time tokens, revokes old sessions and does not reveal registered email addresses',async()=>{
 const {app,mails}=fixture();const origin='http://localhost:4280';
 const user=await request(app).post('/api/auth/sign-up/email').set('Origin',origin).send({name:'Reset test',email:'reset@example.test',password:'Old-password-test123!'}).expect(200);
 const before=user.headers['set-auth-token'];
 const reset=()=>request(app).post('/api/auth/request-password-reset').set('Origin',origin);
 const existing=await reset().send({email:'reset@example.test',redirectTo:origin+'/sifre-sifirla'}).expect(200);
 assert.equal(mails.length,1);assert.equal(mails[0].email,'reset@example.test');
 assert.doesNotMatch(JSON.stringify(existing.body),new RegExp(mails[0].token));
 const missing=await reset().send({email:'absent@example.test',redirectTo:origin+'/sifre-sifirla'}).expect(200);
 assert.deepEqual(existing.body,missing.body);assert.equal(mails.length,1);
 await reset().send({email:'reset@example.test',redirectTo:'https://attacker.example/reset'}).expect(403);
 await reset().send({email:'reset@example.test'}).expect(429);
 const apply=(token:string,password='New-password-test123!')=>request(app).post('/api/auth/reset-password').set('Origin',origin).send({token,newPassword:password});
 await apply('invalid-token').expect(400);
 await apply(mails[0].token).expect(200);
 await apply(mails[0].token).expect(400);
 const oldSession=await request(app).get('/api/auth/get-session').set('Authorization','Bearer '+before).expect(200);assert.equal(oldSession.body,null);
 const login=(password:string)=>request(app).post('/api/auth/sign-in/email').set('Origin',origin).send({email:'reset@example.test',password});
 await login('Old-password-test123!').expect(401);
 const restored=await login('New-password-test123!').expect(200);assert.equal(restored.body.user.id,user.body.user.id);
});
test('expired recovery link cannot change a password',async()=>{
 const {app,database,mails}=fixture();const origin='http://localhost:4280';
 await request(app).post('/api/auth/sign-up/email').set('Origin',origin).send({name:'Expired test',email:'expired@example.test',password:'Old-password-test123!'}).expect(200);
 await request(app).post('/api/auth/request-password-reset').set('Origin',origin).send({email:'expired@example.test'}).expect(200);
 const record=database.verification.find(v=>v.identifier==='reset-password:'+mails[0].token);assert.ok(record);
 assert.ok(new Date(record.expiresAt).getTime()-Date.now()<=1800*1000);
 record.expiresAt=new Date(Date.now()-60000);
 await request(app).post('/api/auth/reset-password').set('Origin',origin).send({token:mails[0].token,newPassword:'New-password-test123!'}).expect(400);
 await request(app).post('/api/auth/sign-in/email').set('Origin',origin).send({email:'expired@example.test',password:'Old-password-test123!'}).expect(200);
});
