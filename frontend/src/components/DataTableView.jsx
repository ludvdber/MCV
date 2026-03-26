import { useState, useMemo, useRef } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TableSortLabel, Paper, TextField, Box, Typography,
} from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';

const ROW_HEIGHT = 32;

/**
 * Virtualized data table — renders only visible rows (30-40 DOM elements)
 * regardless of dataset size (tested up to 6M rows).
 * Supports sorting and text search.
 *
 * @param {Array<{label: string, key: string}>} columns
 * @param {Array<Object>} rows
 */
function DataTableView({ columns, rows }) {
  const { t } = useTranslation();
  const [orderBy, setOrderBy] = useState(null);
  const [order, setOrder] = useState('asc');
  const [search, setSearch] = useState('');
  const parentRef = useRef(null);

  const handleSort = (key) => {
    if (orderBy === key) {
      setOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderBy(key);
      setOrder('asc');
    }
  };

  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(row =>
      columns.some(col => String(row[col.key] ?? '').toLowerCase().includes(q))
    );
  }, [rows, search, columns]);

  const sortedRows = useMemo(() => {
    if (!orderBy) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const va = a[orderBy] ?? 0;
      const vb = b[orderBy] ?? 0;
      if (typeof va === 'number' && typeof vb === 'number') {
        return order === 'asc' ? va - vb : vb - va;
      }
      return order === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [filteredRows, orderBy, order]);

  const virtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2 }}>
        <TextField
          size="small"
          placeholder={t('table.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ maxWidth: 280 }}
        />
        <Typography variant="caption" color="text.secondary">
          {sortedRows.length.toLocaleString()} {t('table.rows')}
        </Typography>
      </Box>
      <TableContainer component={Paper} ref={parentRef} sx={{ maxHeight: 440, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map(col => (
                <TableCell key={col.key} sx={{ fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  <TableSortLabel
                    active={orderBy === col.key}
                    direction={orderBy === col.key ? order : 'asc'}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Spacer for virtualization */}
            <tr style={{ height: virtualizer.getVirtualItems()[0]?.start ?? 0 }} />
            {virtualizer.getVirtualItems().map(virtualRow => {
              const row = sortedRows[virtualRow.index];
              return (
                <TableRow key={virtualRow.index} hover sx={{ height: ROW_HEIGHT }}>
                  {columns.map(col => (
                    <TableCell key={col.key} sx={{ fontSize: '0.78rem', fontFamily: 'monospace', py: 0.3 }}>
                      {typeof row[col.key] === 'number' ? row[col.key].toPrecision(6) : row[col.key]}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
            {/* Bottom spacer */}
            <tr style={{ height: virtualizer.getTotalSize() - (virtualizer.getVirtualItems().at(-1)?.end ?? 0) }} />
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default DataTableView;
