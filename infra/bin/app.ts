// Deploy: AWS_PROFILE=<your profile> npm run deploy (in infra/)
import { App, Tags } from 'aws-cdk-lib'
import { RelayStack } from '../lib/relay-stack'

const app = new App()
const site = 'https://hallowfin.vercel.app'
const stack = new RelayStack(app, 'SquidDareRelay', {
  // Sydney: the only region the account allows
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'ap-southeast-2' },
  site,
  origins: [site, 'http://localhost:5173', 'http://localhost:5297'],
})
Tags.of(stack).add('project', 'squid-dare')
