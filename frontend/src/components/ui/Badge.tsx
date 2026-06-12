import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
}

const variantStyles: Record<
  BadgeVariant,
  { backgroundColor: string; textColor: string; borderColor: string }
> = {
  success: {
    backgroundColor: 'rgba(46, 204, 113, 0.18)',
    textColor: '#2ecc71',
    borderColor: 'rgba(46, 204, 113, 0.4)',
  },
  warning: {
    backgroundColor: 'rgba(243, 156, 18, 0.18)',
    textColor: '#f39c12',
    borderColor: 'rgba(243, 156, 18, 0.4)',
  },
  danger: {
    backgroundColor: 'rgba(231, 76, 60, 0.18)',
    textColor: '#e74c3c',
    borderColor: 'rgba(231, 76, 60, 0.4)',
  },
  info: {
    backgroundColor: 'rgba(100, 255, 218, 0.12)',
    textColor: '#64ffda',
    borderColor: 'rgba(100, 255, 218, 0.35)',
  },
  default: {
    backgroundColor: 'rgba(136, 146, 176, 0.15)',
    textColor: '#8892b0',
    borderColor: 'rgba(136, 146, 176, 0.3)',
  },
};

const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  size = 'md',
  style,
}) => {
  const { backgroundColor, textColor, borderColor } = variantStyles[variant];
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        isSm ? styles.badgeSm : styles.badgeMd,
        { backgroundColor, borderColor },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          isSm ? styles.labelSm : styles.labelMd,
          { color: textColor },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 50,
    borderWidth: 1,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMd: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  labelMd: {
    fontSize: 11,
  },
  labelSm: {
    fontSize: 9,
  },
});

export default Badge;
