import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useControl } from 'react-map-gl';
import type { ControlPosition } from 'react-map-gl';

type DrawControlProps = ConstructorParameters<typeof MapboxDraw>[0] & {
  position?: ControlPosition;
  onCreate?: (evt: { features: any[] }) => void;
  onUpdate?: (evt: { features: any[]; action: string }) => void;
  onDelete?: (evt: { features: any[] }) => void;
};

export default function DrawControl(props: DrawControlProps) {
  useControl<any>(
    () => new MapboxDraw(props),
    ({ map }) => {
      if (props.onCreate) map.on('draw.create', props.onCreate);
      if (props.onUpdate) map.on('draw.update', props.onUpdate);
      if (props.onDelete) map.on('draw.delete', props.onDelete);
    },
    ({ map }) => {
      if (props.onCreate) map.off('draw.create', props.onCreate);
      if (props.onUpdate) map.off('draw.update', props.onUpdate);
      if (props.onDelete) map.off('draw.delete', props.onDelete);
    },
    {
      position: props.position,
    }
  );

  return null;
}