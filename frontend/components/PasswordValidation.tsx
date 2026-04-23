import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import {
  ALLOWED_PASSWORD_SYMBOLS,
  getPasswordChecks,
  hasUnsupportedPasswordSymbol,
  type PasswordChecks,
} from '../utils/passwordValidation';

type Props = {
  password: string;
};

type RuleItemProps = {
  label: string;
  passed: boolean;
};

const AnimatedRuleItem = memo(function AnimatedRuleItem({ label, passed }: RuleItemProps) {
  return (
    <View className="flex-row items-center mb-2">
      <Text className={`mr-2 text-lg ${passed ? 'text-green-500' : 'text-red-500'}`}>
        {passed ? '✔' : '✖'}
      </Text>
      <Text className={`text-sm ${passed ? 'text-green-700' : 'text-gray-500'}`}>
        {label}
      </Text>
    </View>
  );
});

const PasswordValidation = memo(function PasswordValidation({ password }: Props) {
  const checks = useMemo(() => getPasswordChecks(password), [password]);
  const hasUnsupportedSymbol = useMemo(
    () => hasUnsupportedPasswordSymbol(password),
    [password]
  );

  const rules = useMemo(
    () => [
      { key: 'minLength', label: 'At least 8 characters', passed: checks.minLength },
      { key: 'uppercase', label: 'One uppercase letter', passed: checks.uppercase },
      { key: 'lowercase', label: 'One lowercase letter', passed: checks.lowercase },
      { key: 'number', label: 'One number', passed: checks.number },
      {
        key: 'symbol',
        label: `One symbol (${ALLOWED_PASSWORD_SYMBOLS.split('').join(' ')})`,
        passed: checks.symbol && !hasUnsupportedSymbol,
      },
    ],
    [checks, hasUnsupportedSymbol]
  );

  return (
    <View className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
      {rules.map((rule) => (
        <AnimatedRuleItem key={rule.key} label={rule.label} passed={rule.passed} />
      ))}
    </View>
  );
});

export default PasswordValidation;
