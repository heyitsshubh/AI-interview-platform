import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { InterviewService, Interview } from '../../src/services/interviewService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  PENDING:   { color: '#8892b0', bg: 'rgba(136,146,176,0.15)', icon: 'time-outline' },
  ACTIVE:    { color: '#64ffda', bg: 'rgba(100,255,218,0.15)', icon: 'play-circle-outline' },
  COMPLETED: { color: '#2ecc71', bg: 'rgba(46,204,113,0.15)',  icon: 'checkmark-circle-outline' },
  CANCELLED: { color: '#e74c3c', bg: 'rgba(231,76,60,0.15)',   icon: 'close-circle-outline' },
};

function InterviewCard({ item, index }: { item: Interview; index: number }) {
  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, delay: index * 60, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(recruiter)/cheating/${item.id}` as any)}
        activeOpacity={0.8}
      >
        <LinearGradient colors={['#1e2a4a', '#16213e']} style={styles.cardGradient}>
          <View style={styles.cardTop}>
            <View style={styles.cardIcon}>
              <Ionicons name="briefcase-outline" size={20} color={Colors.accent} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.jobTitle} numberOfLines={1}>{item.job_title}</Text>
              <Text style={styles.dateText}>
                {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
              <Text style={[styles.statusText, { color: cfg.color }]}>{item.status}</Text>
            </View>
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.qCount}>
              <Ionicons name="help-circle-outline" size={13} color={Colors.textSecondary} />
              {' '}{item.total_questions} questions
            </Text>
            <View style={styles.viewRow}>
              <Text style={styles.viewText}>View Report</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function RecruiterInterviewsScreen() {
  const insets = useSafeAreaInsets();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [filtered, setFiltered] = useState<Interview[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await InterviewService.getAllInterviews();
      setInterviews(data);
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
    let result = interviews;
    if (statusFilter !== 'ALL') result = result.filter((i) => i.status === statusFilter);
    if (query.trim()) result = result.filter((i) => i.job_title.toLowerCase().includes(query.toLowerCase()));
    setFiltered(result);
  }, [query, statusFilter, interviews]);

  const STATUS_TABS = ['ALL', 'PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <Text style={styles.title}>All Interviews</Text>
        <Text style={styles.subtitle}>{filtered.length} total</Text>
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by job title..."
          placeholderTextColor={Colors.textSecondary}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status filter tabs */}
      <FlatList
        data={STATUS_TABS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s}
        style={styles.tabList}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        renderItem={({ item: tab }) => (
          <TouchableOpacity
            style={[styles.tab, statusFilter === tab && styles.tabActive]}
            onPress={() => setStatusFilter(tab)}
          >
            <Text style={[styles.tabText, statusFilter === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        )}
      />

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        renderItem={({ item, index }) => <InterviewCard item={item} index={index} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accent} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No interviews found</Text>
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
  tabList:      { maxHeight: 44, marginBottom: 4 },
  tab:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tabActive:    { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tabText:      { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  tabTextActive:{ color: '#fff' },
  card:         { marginBottom: 12, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  cardGradient: { padding: 16 },
  cardTop:      { flexDirection: 'row', alignItems: 'center' },
  cardIcon:     { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(233,69,96,0.15)', justifyContent: 'center', alignItems: 'center' },
  jobTitle:     { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  dateText:     { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  statusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  statusText:   { fontSize: 11, fontWeight: '700' },
  cardFooter:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  qCount:       { color: Colors.textSecondary, fontSize: 12 },
  viewRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewText:     { color: Colors.accent, fontSize: 12, fontWeight: '600' },
  empty:        { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:    { color: Colors.textSecondary, fontSize: 16 },
});
