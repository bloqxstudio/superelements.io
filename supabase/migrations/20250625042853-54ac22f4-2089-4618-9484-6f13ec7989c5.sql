
-- Create RLS policies for the connections table

-- Policy for INSERT: Users can create their own connections
CREATE POLICY "Users can create their own connections" 
  ON public.connections 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Policy for SELECT: Users can view their own connections
CREATE POLICY "Users can view their own connections" 
  ON public.connections 
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = created_by);

-- Policy for UPDATE: Users can update their own connections
CREATE POLICY "Users can update their own connections" 
  ON public.connections 
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = created_by);

-- Policy for DELETE: Users can delete their own connections
CREATE POLICY "Users can delete their own connections" 
  ON public.connections 
  FOR DELETE 
  TO authenticated
  USING (auth.uid() = created_by);

-- Additional policy for admins to manage all connections
CREATE POLICY "Admins can manage all connections" 
  ON public.connections 
  FOR ALL 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
