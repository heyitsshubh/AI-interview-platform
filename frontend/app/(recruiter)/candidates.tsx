import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import { InterviewService } from '../../src/services/interviewService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Candidate {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
  created_at: string;
}

function CandidateCard({ item, index }: { item: Candidate; index: number }) {
  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  const initials = item.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const joinDate = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Generate consistent gradient from name hash
  const gradients: [string, string][] = [
    ['#e94560', '#c0392b'],
    ['#64ffda', '#00b894'],
    ['#3498db', '#2980b9'],
    ['#9b59b6', '#8e44ad'],
    ['#f39c12', '#e67e22'],
  ];
  const grad = gradients[item.full_name.charCodeAt(0) % gradients.length];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, delay: index * 70, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, delay: index * 70, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <View style={styles.card}>
        <LinearGradient colors={['#1e2a4a', '#16213e']} style={styles.cardGradient}>
          <View style={styles.cardRow}>
            {/* Avatar */}
            <LinearGradient colors={grad} style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </LinearGradient>

            {/* Info */}
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.name}>{item.full_name}</Text>
              <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
              <Text style={styles.date}>Joined {joinDate}</Text>
            </View>

            {/* Status dot */}
            <View style={[styles.activeDot, { backgroundColor: item.is_active ? Colors.success : Colors.danger }]} />
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

export default function RecruiterCandidatesScreen() {
  const insets = useSafeAreaInsets();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filtered, setFiltered] = useState<Candidate[]>([]);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await InterviewService.getCandidates();
      setCandidates(data);
      setFiltered(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!query.trim()) { setFiltered(candidates); return; }
    setFiltered(
      candidates.filter(
        (c) =>
          c.full_name.toLowerCase().includes(query.toLowerCase()) ||
          c.email.toLowerCase().includes(query.toLowerCase()),
      ),
    );
  }, [query, candidates]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <Text style={styles.title}>Candidates</Text>
        <Text style={styles.subtitle}>{filtered.length} registered</Text>
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or email..."
          placeholderTextColor={Colors.textSecondary}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        renderItem={({ item, index }) => <CandidateCard item={item} index={index} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={Colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={56} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No candidates found</Text>
            <Text style={styles.emptySubtitle}>Candidates will appear here after they sign up.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  header:       { paddingHorizontal: 20, paddingVertical: 20 },
  title:        { color: Colors.textPrimary, fontSize: 24, fontWeight: '700' },
  subtitle:     { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  searchWrap:   { flexDirection: 'row', alignItems: 'center', margin: 16, backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  searchInput:  { flex: 1, color: Colors.textPrimary, fontSize: 15 },
  card:         { marginBottom: 12, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  cardGradient: { padding: 16 },
  cardRow:      { flexDirection: 'row', alignItems: 'center' },
  avatar:       { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  avatarText:   { color: '#fff', fontSize: 18, fontWeight: '700' },
  name:         { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  email:        { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  date:         { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
  activeDot:    { width: 10, height: 10, borderRadius: 5 },
  empty:        { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle:   { color: Colors.textSecondary, fontSize: 18, fontWeight: '600' },
  emptySubtitle:{ color: Colors.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});
