import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { StorageStack } from '../lib/stacks/storage';

describe('StorageStack', () => {
  let devTemplate: Template;
  let prodTemplate: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const devStack = new StorageStack(app, 'dev', { stageName: 'dev' });
    const prodStack = new StorageStack(app, 'prod', { stageName: 'prod' });
    devTemplate = Template.fromStack(devStack);
    prodTemplate = Template.fromStack(prodStack);
  });

  // CloudFormation テンプレート全体の意図しない変更を検知する
  describe('snapshot', () => {
    test('dev', () => {
      expect(devTemplate.toJSON()).toMatchSnapshot();
    });

    test('prod', () => {
      expect(prodTemplate.toJSON()).toMatchSnapshot();
    });
  });

  // アプリ側が直接参照するテーブル名が変わっていないことを保証する
  describe('table names', () => {
    test('dev tables have dev- prefix', () => {
      devTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-user_chat_count',
      });
      devTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-user_chat_history',
      });
    });

    test('prod tables have prod- prefix', () => {
      prodTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'prod-user_chat_count',
      });
      prodTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'prod-user_chat_history',
      });
    });
  });

  // パーティションキー・ソートキーが変わるとアプリのクエリが全て壊れるため保証する
  describe('key schema', () => {
    test('user_chat_count has trial_uuid (HASH) + date (RANGE)', () => {
      devTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-user_chat_count',
        KeySchema: [
          { AttributeName: 'trial_uuid', KeyType: 'HASH' },
          { AttributeName: 'date', KeyType: 'RANGE' },
        ],
      });
    });

    test('user_chat_history has trial_uuid (HASH) + timestamp (RANGE)', () => {
      devTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-user_chat_history',
        KeySchema: [
          { AttributeName: 'trial_uuid', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' },
        ],
      });
    });
  });

  // prod で PITR が無効化されるとデータロスト時に復旧不可になるため保証する
  describe('point-in-time recovery', () => {
    test('dev has PITR disabled', () => {
      devTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-user_chat_count',
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: false },
      });
    });

    test('prod has PITR enabled', () => {
      prodTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'prod-user_chat_count',
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
      });
    });
  });

  // スタック削除時にテーブルが消えないよう RETAIN が設定されていることを保証する
  describe('removal policy', () => {
    test('all tables have Retain policy', () => {
      const devResources = devTemplate.toJSON().Resources;
      const prodResources = prodTemplate.toJSON().Resources;

      for (const [, resource] of Object.entries(devResources)) {
        const r = resource as any;
        if (r.Type === 'AWS::DynamoDB::Table') {
          expect(r.DeletionPolicy).toBe('Retain');
          expect(r.UpdateReplacePolicy).toBe('Retain');
        }
      }

      for (const [, resource] of Object.entries(prodResources)) {
        const r = resource as any;
        if (r.Type === 'AWS::DynamoDB::Table') {
          expect(r.DeletionPolicy).toBe('Retain');
          expect(r.UpdateReplacePolicy).toBe('Retain');
        }
      }
    });
  });
});
