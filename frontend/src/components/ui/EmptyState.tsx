import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import PrimaryButton from './PrimaryButton';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}) => {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(233, 69, 96, 0.2)', 'rgba(100, 255, 218, 0.1)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconContainer}
      >
        <Ionicons name={icon} size={48} color="#e94560" />
      </LinearGradient>

      <Text style={styles.title}>{title}</Text>

      {subtitle ? (
        <Text style={styles.subtitle}>{subtitle}</Text>
      ) : null}

      {actionLabel && onAction ? (
        <View style={styles.actionWrapper}>
          <PrimaryButton
            title={actionLabel}
            onPress={onAction}
            variant="primary"
            icon="arrow-forward"
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.3)',
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ccd6f6',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#8892b0',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  actionWrapper: {
    marginTop: 24,
  },
});

export default EmptyState;
