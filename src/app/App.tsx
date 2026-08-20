import { VisionApiProvider } from './VisionApiProvider'
import { HomeScreen } from '../screens/HomeScreen'

export function App() {
  return (
    <VisionApiProvider>
      <HomeScreen />
    </VisionApiProvider>
  )
}
