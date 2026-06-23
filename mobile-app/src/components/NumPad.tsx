import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';

type Props = {
  onPress: (key: string) => void;
};

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'DEL'],
];

export default function NumPad({ onPress }: Props) {
  return (
    <View style={styles.container}>
      {KEYS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.key,
                key === 'DEL' && styles.keyDel,
                key === '.' && styles.keyDot,
              ]}
              onPress={() => onPress(key)}
              activeOpacity={0.6}
            >
              {key === 'DEL' ? (
                <Ionicons name="backspace-outline" size={20} color={COLORS.textSecondary} />
              ) : (
                <Text
                  style={[
                    styles.keyText,
                    key === '.' && styles.keyTextDot,
                  ]}
                >
                  {key}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  key: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  keyDel: {
    backgroundColor: COLORS.surface,
  },
  keyDot: {
    backgroundColor: COLORS.surface,
  },
  keyText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  keyTextDot: {
    fontSize: 28,
    fontWeight: '900',
  },
});
