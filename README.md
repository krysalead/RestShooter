# RestShooter

Rest Shooter is a node module able to take a list of scenario of URLs to call and check the response.
A Scenario is a list of steps, a step is a URL with parameter and checks (optional)

- Run HTTP and HTTPS
- Run POST,GET,DELETE,PUT
- Check global field for a scenario
- Check specific field for a step
- Support only JSON and XML
- Allows to propagate a session along a scenario
- Allows to hook on request

# How to use it

## Installation

```bash
npm install -g restshooter
```

Then create a script in your package.json to let it run in NPM context rather that bash context.

## Sample Project

```
import { expect } from 'chai';
import { v1 as uuidv1 } from 'uuid';

let updateToken = (requestOptions, authToken, orgaId?) => {
  requestOptions.headers = requestOptions.headers ? requestOptions.headers : [];
  requestOptions.headers['x-access-token'] = authToken;
  requestOptions.headers['x-organization-id'] = orgaId;
  return Promise.resolve(requestOptions);
};

let generateEmail = (domain?: string) => {
  return uuidv1() + '@' + (domain ? domain : 'koteez.com');
};

describe('invitation', function() {
  describe('to add a club to a federation', function() {
    const shooter = require('shooter-chai');
    const pilot = require('../pilote');
    const options = {
      debug: false,
      verbose: false,
      BASE_URL: 'http://localhost:4000/v1'
    };
    let adminUser = {
      login: 'admin@koteez.com',
      password: 'T3stP4ssw0rd'
    };
    let initialData = {
      FederationDAO: [
        {
          name: 'Testing',
          logo: 'Nologo',
          hasCustomization: false,
          quota: 1
        }
      ],
      UserAuthDAO: [
        {
          login: adminUser.login,
          password: adminUser.password + '|password',
          channel: 'EmailPass',
          roles: ['adminFede'],
          validated: true
        }
      ],
      UserDAO: [
        {
          userId: '${UserAuthDAO[0]._id}',
          firstName: 'Test',
          lastName: 'Fede',
          organizations: ['${FederationDAO[0]._id}']
        }
      ]
    };
    let injectedData;
    let authToken;
    beforeEach(function(done) {
      // tslint:disable-next-line:no-invalid-this
      this.timeout(3000);
      pilot.resetDatabase();
      pilot.injectData(initialData).then(
        data => {
          injectedData = data;
          done();
        },
        e => {
          console.error('BeforeEach failed', e);
        }
      );
    });
    it('cannot be created due to quota', done => {
      const invitationPayload = {
        emails: ['test@club.com'],
        federationId: injectedData.FederationDAO[0].id,
        amount: 2
      };
      shooter(options)
        .shoot({
          POST: '/auth/login',
          postCall: function(response) {
            authToken = response.token;
          }
        })
        .with(adminUser)
        .check([
          {
            path: 'message',
            test: 'exist|'
          }
        ])
        .then({
          POST: '/invitation/club',
          preCall: requestOptions => {
            return pilot
              .injectData({
                InvitationDAO: [
                  {
                    federationId: injectedData.FederationDAO[0].id,
                    counter: 1,
                    type: 'adminClub'
                  }
                ]
              })
              .then(() => {
                return updateToken(
                  requestOptions,
                  authToken,
                  injectedData.FederationDAO[0].id
                );
              });
          }
        })
        .with(invitationPayload)
        .check([
          {
            path: 'message',
            test: 'exist|Too much invitation created'
          },
          {
            path: 'status',
            test: -1002
          }
        ])
        .end(done);
    });
    it('can be sent', done => {
      let clubEmail = generateEmail();
      const invitationPayload = {
        emails: [clubEmail],
        federationId: injectedData.FederationDAO[0].id
      };
      shooter(options)
        .shoot({
          POST: '/auth/login',
          postCall: function(response) {
            authToken = response.token;
          }
        })
        .with(adminUser)
        .check([
          {
            path: 'message',
            test: 'exist|'
          }
        ])
        .then({
          POST: '/invitation/club',
          preCall: requestOptions => {
            return pilot.mockEmail().then(() => {
              return updateToken(
                requestOptions,
                authToken,
                injectedData.FederationDAO[0].id
              );
            });
          }
        })
        .with(invitationPayload)
        .check({
          path: 'data.invitationId',
          test: 'exist'
        })
        .end(() => {
          pilot
            .getLastEmail(clubEmail)
            .then(emailObject => {
              // tslint:disable-next-line:no-unused-expression
              expect(emailObject, 'emailObject').not.to.be.undefined;
              expect(emailObject.subject).to.equals(
                'Inscrivez vous sur Koteez !'
              );
              expect(emailObject.to).to.equals(clubEmail);
            })
            .then(done)
            .catch(done);
        });
    });
    // need to create the invitation first and use the replacement to consume it
    it.skip('can be consumed', done => {
      let clubEmail = generateEmail();
      let invitationInjected;
      shooter(options)
        .shoot({
          POST: '/auth/login',
          postCall: function(response) {
            authToken = response.token;
          }
        })
        .with(adminUser)
        .check([
          {
            path: 'message',
            test: 'exist|'
          }
        ])
        .then({
          POST: '/club/create',
          preCall: requestOptions => {
            return pilot
              .injectData({
                InvitationDAO: [
                  {
                    federationId: injectedData.FederationDAO[0].id,
                    counter: 1,
                    type: 'adminClub'
                  }
                ]
              })
              .then(injected => {
                invitationInjected = injected;
                return updateToken(requestOptions, authToken);
              });
          }
        })
        .with({
          invitationId: invitationInjected.InvitationDAO[0].id,
          name: 'e2etestClub',
          code: '123324',
          zipCode: '06200'
        })
        .check([
          {
            path: 'data.id',
            test: 'exist'
          },
          {
            path: 'data.name',
            test: 'e2etestClub'
          }
        ])
        .end(done);
    });
  });
});

```
