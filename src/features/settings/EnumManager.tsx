'use client';

import { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EnumTable } from './components/EnumTable';
import { ENUM_CONFIGS, type EntityType } from './config/enumConfigs';

export function EnumManager() {
  const [selectedEntity, setSelectedEntity] = useState<EntityType>('agencies');

  const currentConfig = ENUM_CONFIGS[selectedEntity];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1 max-w-xs">
            <Select
              value={selectedEntity}
              onValueChange={(value: EntityType) => setSelectedEntity(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agencies">Agences</SelectItem>
                <SelectItem value="metiers">Métiers</SelectItem>
                <SelectItem value="intervention-statuses">Statuts d&apos;Intervention</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            {currentConfig.description}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <EnumTable config={currentConfig} />
      </CardContent>
    </Card>
  );
}
