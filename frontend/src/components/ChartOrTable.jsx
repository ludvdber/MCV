import { useState } from 'react';
import { Box, Button } from '@mui/material';
import { TableChart as TableIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import DataTableView from './DataTableView';

/**
 * Wrapper that toggles between chart and data table.
 * The toggle button is exposed via `renderButton` — place it in the action bar.
 *
 * Usage:
 *   <ChartOrTable tableData={tableData}>
 *     {(showTable, TableButton) => (
 *       <>
 *         <ActionBar>
 *           <PermalienButton />
 *           <ExportMenu />
 *           <TableButton />      ← place the button where you want
 *         </ActionBar>
 *         {!showTable && <Viewer ... />}
 *       </>
 *     )}
 *   </ChartOrTable>
 */
export default function ChartOrTable({ children, tableData }) {
  const { t } = useTranslation();
  const [showTable, setShowTable] = useState(false);

  if (!tableData) {
    // No table data — render children normally (pass false + null button)
    return typeof children === 'function' ? children(false, () => null) : children;
  }

  const TableButton = () => (
    <Button
      size="small"
      variant={showTable ? 'contained' : 'outlined'}
      color={showTable ? 'primary' : 'secondary'}
      startIcon={<TableIcon sx={{ fontSize: 16 }} />}
      onClick={() => setShowTable(v => !v)}
      sx={{ textTransform: 'none', fontSize: '0.8rem' }}
    >
      {showTable ? t('table.tabChart') : t('table.tabTable')}
    </Button>
  );

  if (typeof children === 'function') {
    return (
      <Box>
        {children(showTable, TableButton)}
        {showTable && <DataTableView columns={tableData.columns} rows={tableData.rows} />}
      </Box>
    );
  }

  // Fallback: legacy usage without render prop
  return (
    <Box>
      {showTable
        ? <DataTableView columns={tableData.columns} rows={tableData.rows} />
        : children
      }
    </Box>
  );
}
